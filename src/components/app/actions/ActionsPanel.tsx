"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { isDeployed } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { NotDeployedNotice } from "@/components/NotDeployedNotice";
import { CollateralForm } from "./CollateralForm";
import { CreditForm } from "./CreditForm";

const TABS = ["Deposit", "Borrow", "Repay", "Withdraw"] as const;
type Tab = (typeof TABS)[number];

export function ActionsPanel() {
  const [tab, setTab] = useState<Tab>("Deposit");

  if (!isDeployed) {
    return (
      <NotDeployedNotice
        title="Deposit, borrow and repay"
        description="These actions call the margin vault, which isn't deployed to X Layer yet. Deploy the contracts and this panel becomes live: deposit an xStocks wrapper, draw USD₮0 against it, and repay when you like."
      />
    );
  }

  return (
    <Card className="p-5">
      <div className="flex gap-1 rounded-lg border border-line bg-ink p-1">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs transition-colors",
              tab === item ? "bg-brass/10 text-brass" : "text-muted hover:text-text",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "Deposit" && <CollateralForm mode="deposit" />}
        {tab === "Withdraw" && <CollateralForm mode="withdraw" />}
        {tab === "Borrow" && <CreditForm mode="borrow" />}
        {tab === "Repay" && <CreditForm mode="repay" />}
      </div>
    </Card>
  );
}
