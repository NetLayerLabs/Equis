// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ChainlinkPriceOracle} from "../src/ChainlinkPriceOracle.sol";
import {EquisLendingPool} from "../src/EquisLendingPool.sol";
import {EquisMarginVault} from "../src/EquisMarginVault.sol";
import {EquisSessionDelegate} from "../src/EquisSessionDelegate.sol";
import {KinkedRateModel} from "../src/KinkedRateModel.sol";
import {IVerifierProxy} from "../src/interfaces/chainlink/IVerifierProxy.sol";
import {AggregatorV3Interface} from "../src/interfaces/chainlink/AggregatorV3Interface.sol";
import {XLayer} from "../src/libraries/XLayer.sol";

/// @notice Deploys and configures Equis on X Layer mainnet.
///
///   node ../scripts/fetch-stream-reports.ts                                                     # fresh prices
///   forge script script/DeployEquis.s.sol --rpc-url xlayer --account equis-deployer             # dry run
///   forge script script/DeployEquis.s.sol --rpc-url xlayer --account equis-deployer --broadcast # deploy
///
/// Collateral caps are set in USD and converted to token units at the live Chainlink price, which the script
/// verifies on-chain first. The deployer configures everything, then proposes ownership to EQUIS_OWNER, who
/// must call acceptOwnership() on the pool, oracle and vault.
contract DeployEquis is Script {
    struct Market {
        address wrapper;
        bytes32 stream;
        uint16 ltvBps;
        uint16 liquidationThresholdBps;
        uint16 liquidationBonusBps;
        /// @dev ~8–9% of the wrapper's main X Layer DEX pool, so a fully liquidated cap can be sold.
        uint256 capUsd;
    }

    string internal constant REPORTS_PATH = "test/fixtures/stream-reports.json";
    uint256 internal constant MAX_REPORTS_AGE = 90 seconds;

    // Lending pool: guarded launch.
    uint256 internal constant POOL_SUPPLY_CAP = 250_000e6;
    uint256 internal constant RESERVE_FACTOR = 0.1e18;

    // Borrow rate: 0% base, 8% APR at 80% utilization, rising to 108% APR at 100%.
    uint256 internal constant BASE_RATE = 0;
    uint256 internal constant SLOPE_1 = 0.08e18;
    uint256 internal constant SLOPE_2 = 1e18;
    uint256 internal constant KINK = 0.8e18;

    // Oracle: stock reports are submitted in the same transaction that uses them.
    uint32 internal constant MAX_REPORT_AGE = 2 minutes;
    uint32 internal constant CORPORATE_ACTION_WINDOW = 1 days;
    uint32 internal constant USDT0_FEED_MAX_AGE = 25 hours;

    function markets() public pure returns (Market[] memory m) {
        m = new Market[](5);
        m[0] = Market(XLayer.WNVDAX, XLayer.STREAM_NVDAX, 5_000, 6_000, 750, 50_000e18); // pool ~$584k
        m[1] = Market(XLayer.WAAPLX, XLayer.STREAM_AAPLX, 5_000, 6_000, 750, 35_000e18); // pool ~$376k
        m[2] = Market(XLayer.WTSLAX, XLayer.STREAM_TSLAX, 4_000, 5_000, 1_000, 35_000e18); // pool ~$390k
        m[3] = Market(XLayer.WSPYX, XLayer.STREAM_SPYX, 6_000, 7_000, 500, 150_000e18); // pool ~$1.94M
        m[4] = Market(XLayer.WQQQX, XLayer.STREAM_QQQX, 6_000, 7_000, 500, 75_000e18); // pool ~$892k
    }

    function run() external {
        require(block.chainid == XLayer.CHAIN_ID, "not X Layer mainnet");
        address owner = vm.envAddress("EQUIS_OWNER");
        address guardian = vm.envAddress("EQUIS_GUARDIAN");
        address treasury = vm.envAddress("EQUIS_TREASURY");
        bytes[] memory reports = _loadFreshReports();
        Market[] memory m = markets();

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        KinkedRateModel rateModel = new KinkedRateModel(BASE_RATE, SLOPE_1, SLOPE_2, KINK);
        EquisLendingPool pool =
            new EquisLendingPool(IERC20(XLayer.USDT0), rateModel, deployer, treasury, RESERVE_FACTOR, POOL_SUPPLY_CAP);
        ChainlinkPriceOracle oracle = new ChainlinkPriceOracle(
            IVerifierProxy(XLayer.CHAINLINK_STREAMS_VERIFIER),
            AggregatorV3Interface(XLayer.CHAINLINK_SEQUENCER_UPTIME),
            deployer
        );
        EquisMarginVault vault = new EquisMarginVault(pool, oracle, deployer, guardian);
        EquisSessionDelegate sessionDelegate = new EquisSessionDelegate();

        pool.setVault(address(vault));
        oracle.setFeed(XLayer.USDT0, AggregatorV3Interface(XLayer.CHAINLINK_USDT0_USD), USDT0_FEED_MAX_AGE);
        for (uint256 i; i < m.length; ++i) {
            oracle.setStream(m[i].wrapper, m[i].stream, MAX_REPORT_AGE, CORPORATE_ACTION_WINDOW);
        }

        oracle.updatePrices(reports);
        for (uint256 i; i < m.length; ++i) {
            (uint256 price,) = oracle.getPrice(m[i].wrapper);
            uint256 capTokens = m[i].capUsd * 1e18 / price;
            vault.listCollateral(
                m[i].wrapper, m[i].ltvBps, m[i].liquidationThresholdBps, m[i].liquidationBonusBps, capTokens
            );
            console.log("collateral", m[i].wrapper, "cap (tokens, 18 dec)", capTokens);
        }

        pool.transferOwnership(owner);
        oracle.transferOwnership(owner);
        vault.transferOwnership(owner);
        vm.stopBroadcast();

        console.log("KinkedRateModel      ", address(rateModel));
        console.log("EquisLendingPool     ", address(pool));
        console.log("ChainlinkPriceOracle ", address(oracle));
        console.log("EquisMarginVault     ", address(vault));
        console.log("EquisSessionDelegate ", address(sessionDelegate));
        console.log("Pending owner (must acceptOwnership on pool, oracle, vault):", owner);
    }

    function _loadFreshReports() internal view returns (bytes[] memory reports) {
        string memory json = vm.readFile(REPORTS_PATH);
        require(
            block.timestamp <= vm.parseJsonUint(json, ".forkTimestamp") + MAX_REPORTS_AGE,
            "reports are stale: rerun node ../scripts/fetch-stream-reports.ts"
        );

        Market[] memory m = markets();
        reports = new bytes[](m.length);
        for (uint256 i; i < m.length; ++i) {
            string memory key = string.concat(".reports[", vm.toString(i), "]");
            require(vm.parseJsonAddress(json, string.concat(key, ".wrapper")) == m[i].wrapper, "report order");
            reports[i] = vm.parseJsonBytes(json, string.concat(key, ".fullReport"));
        }
    }
}
