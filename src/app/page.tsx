import { BuiltWith } from "@/components/landing/BuiltWith";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingNav } from "@/components/landing/LandingNav";
import { ThreeWaysIn } from "@/components/landing/ThreeWaysIn";
import { VerifiedOnChain } from "@/components/landing/VerifiedOnChain";
import { readChainFacts } from "@/lib/server/chainFacts";

// The page quotes live chain readings, so it is re-rendered rather than frozen at build time.
export const revalidate = 60;

export default async function LandingPage() {
  const facts = await readChainFacts();

  return (
    <div className="bg-ink text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brass focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-deep"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main">
        <Hero facts={facts} />
        <HowItWorks />
        <Features />
        <ThreeWaysIn />
        <VerifiedOnChain facts={facts} />
        <BuiltWith />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}
