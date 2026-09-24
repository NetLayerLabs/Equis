// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {EquisLendingPool} from "../src/EquisLendingPool.sol";
import {EquisMarginVault} from "../src/EquisMarginVault.sol";
import {EquisSessionDelegate} from "../src/EquisSessionDelegate.sol";
import {KinkedRateModel} from "../src/KinkedRateModel.sol";
import {RedStonePriceOracle} from "../src/RedStonePriceOracle.sol";
import {AggregatorV3Interface} from "../src/interfaces/chainlink/AggregatorV3Interface.sol";
import {XLayer} from "../src/libraries/XLayer.sol";

/// @notice Deploys and configures Equis on X Layer mainnet.
///
///   node ../scripts/fetch-redstone-payload.ts                                                   # fresh prices
///   forge script script/DeployEquis.s.sol --rpc-url xlayer --account equis-deployer             # dry run
///   forge script script/DeployEquis.s.sol --rpc-url xlayer --account equis-deployer --broadcast # deploy
///
/// Collateral caps are set in USD and converted to token units at the price this script verifies onchain
/// during deployment. The deployer configures everything, then proposes ownership to EQUIS_OWNER, who must
/// call acceptOwnership() on the pool, oracle and vault.
contract DeployEquis is Script {
    struct Market {
        address wrapper;
        bytes32 redstoneFeed;
        uint16 ltvBps;
        uint16 liquidationThresholdBps;
        uint16 liquidationBonusBps;
        /// @dev ~8-9% of the wrapper's main X Layer DEX pool, so a fully liquidated cap can be sold.
        uint256 capUsd;
    }

    string internal constant PAYLOAD_PATH = "test/fixtures/redstone-payload.json";
    /// @dev RedStone rejects a payload older than three minutes; leave room for the broadcast itself.
    uint256 internal constant MAX_PAYLOAD_AGE = 90 seconds;

    // Lending pool: guarded launch.
    uint256 internal constant POOL_SUPPLY_CAP = 250_000e6;
    uint256 internal constant RESERVE_FACTOR = 0.1e18;

    // Borrow rate: 0% base, 8% APR at 80% utilization, rising to 108% APR at 100%.
    uint256 internal constant BASE_RATE = 0;
    uint256 internal constant SLOPE_1 = 0.08e18;
    uint256 internal constant SLOPE_2 = 1e18;
    uint256 internal constant KINK = 0.8e18;

    // Oracle windows: prices are refreshed inside the borrow transaction itself.
    uint32 internal constant PRICE_MAX_AGE = 3 days;
    uint32 internal constant MARKET_OPEN_WINDOW = 15 minutes;
    uint32 internal constant USDT0_FEED_MAX_AGE = 25 hours;

    /// @dev Only these three have a public RedStone feed; SPY and QQQ do not, so they are not listed.
    function markets() public pure returns (Market[] memory m) {
        m = new Market[](3);
        m[0] = Market(XLayer.WNVDAX, bytes32("NVDA---24_7"), 5_000, 6_000, 750, 50_000e18); // pool ~$584k
        m[1] = Market(XLayer.WAAPLX, bytes32("AAPL---24_7"), 5_000, 6_000, 750, 35_000e18); // pool ~$376k
        m[2] = Market(XLayer.WTSLAX, bytes32("TSLA---24_7"), 4_000, 5_000, 1_000, 35_000e18); // pool ~$390k
    }

    struct Deployment {
        KinkedRateModel rateModel;
        EquisLendingPool pool;
        RedStonePriceOracle oracle;
        EquisMarginVault vault;
        EquisSessionDelegate sessionDelegate;
    }

    function run() external {
        require(block.chainid == XLayer.CHAIN_ID, "not X Layer mainnet");
        bytes[] memory reports = _loadFreshPayload();

        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();

        Deployment memory d = _deploy(deployer);
        _configure(d, reports);
        _handOver(d, deployer);
        vm.stopBroadcast();

        _report(d, deployer);
    }

    function _deploy(address deployer) internal returns (Deployment memory d) {
        d.rateModel = new KinkedRateModel(BASE_RATE, SLOPE_1, SLOPE_2, KINK);
        d.pool = new EquisLendingPool(
            IERC20(XLayer.USDT0),
            d.rateModel,
            deployer,
            _role("EQUIS_TREASURY", deployer),
            RESERVE_FACTOR,
            POOL_SUPPLY_CAP
        );
        d.oracle = new RedStonePriceOracle(AggregatorV3Interface(XLayer.CHAINLINK_SEQUENCER_UPTIME), deployer);
        d.vault = new EquisMarginVault(d.pool, d.oracle, deployer, _role("EQUIS_GUARDIAN", deployer));
        d.sessionDelegate = new EquisSessionDelegate();
    }

    function _configure(Deployment memory d, bytes[] memory reports) internal {
        d.pool.setVault(address(d.vault));
        d.oracle.setFeed(XLayer.USDT0, AggregatorV3Interface(XLayer.CHAINLINK_USDT0_USD), USDT0_FEED_MAX_AGE);

        Market[] memory m = markets();
        for (uint256 i; i < m.length; ++i) {
            d.oracle.listStock(m[i].wrapper, m[i].redstoneFeed, PRICE_MAX_AGE, MARKET_OPEN_WINDOW);
        }

        // Verify a real payload onchain, then size each cap from the price it produced.
        d.oracle.updatePrices(reports);
        for (uint256 i; i < m.length; ++i) {
            (uint256 price,) = d.oracle.getPrice(m[i].wrapper);
            uint256 capTokens = m[i].capUsd * 1e18 / price;
            d.vault
                .listCollateral(
                    m[i].wrapper, m[i].ltvBps, m[i].liquidationThresholdBps, m[i].liquidationBonusBps, capTokens
                );
            console.log("listed", m[i].wrapper, "cap (18 dec)", capTokens);
        }
    }

    /// @dev Ownable2Step: the new owner must accept on each contract before it takes effect.
    function _handOver(Deployment memory d, address deployer) internal {
        address owner = _role("EQUIS_OWNER", deployer);
        if (owner == deployer) return;
        d.pool.transferOwnership(owner);
        d.oracle.transferOwnership(owner);
        d.vault.transferOwnership(owner);
    }

    function _report(Deployment memory d, address deployer) internal view {
        console.log("KinkedRateModel       ", address(d.rateModel));
        console.log("EquisLendingPool      ", address(d.pool));
        console.log("RedStonePriceOracle   ", address(d.oracle));
        console.log("EquisMarginVault      ", address(d.vault));
        console.log("EquisSessionDelegate  ", address(d.sessionDelegate));
        console.log("Owner                 ", _role("EQUIS_OWNER", deployer));
    }

    /// @dev Each role falls back to the deployer, so one funded key is enough to launch. Point EQUIS_OWNER at
    ///      a multisig before this holds anything you would miss.
    function _role(string memory name, address fallbackAddress) internal view returns (address) {
        return vm.envOr(name, fallbackAddress);
    }

    /// @dev Packs the fetched payload the way RedStonePriceOracle.updatePrices expects.
    function _loadFreshPayload() internal view returns (bytes[] memory reports) {
        string memory json = vm.readFile(PAYLOAD_PATH);
        require(
            block.timestamp <= vm.parseJsonUint(json, ".timestampSeconds") + MAX_PAYLOAD_AGE,
            "payload is stale: rerun node ../scripts/fetch-redstone-payload.ts"
        );

        reports = new bytes[](1);
        reports[0] = abi.encode(vm.parseJsonAddressArray(json, ".assets"), vm.parseJsonBytes(json, ".payload"));
    }
}
