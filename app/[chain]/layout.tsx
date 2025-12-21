import { Metadata } from "next";

interface Props {
  children: React.ReactNode;
  params: { chain: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const chain = params.chain;

  try {
    // fetch chain data using route param
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/chains`, {
      cache: "no-store",
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Response is not JSON:", await res.text());
      throw new Error("Response is not JSON");
    }
    
    const chains = await res.json();

    const selected = chains.find(
      (c: any) =>
        c.chain_name.toLowerCase().replace(/\s+/g, "-") === chain.toLowerCase()
    );

    if (!selected) {
      return {
        title: "Chain Not Found — WinScan",
        description: "Explore blockchain data with WinScan",
      };
    }

    const chain_name = selected.chain_name
      .split("-")
    .map(
      (content: string) => content.charAt(0).toUpperCase() + content.slice(1)
    )
    .join(" ");
  const title = `${chain_name} Explorer — WinScan`;

  const description = `Winscan allows you to explore and search the ${chain_name} blockchain for transactions, addresses, tokens, prices and other activities taking place on ${chain_name}`;

  const image = selected.logo ?? "/logo.svg";

  return {
    title,
    description,
    keywords: [
      title,
      `${chain_name} scan`,
      `WinScan Explorer`,
      `winscan`,
      `explorer ${chain_name}`,
    ],
    openGraph: {
      title,
      description,
      images: [image],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
  } catch (error) {
    console.error("Error fetching chain metadata:", error);
    
    // Return fallback metadata
    return {
      title: "Blockchain Explorer — WinScan",
      description: "Explore blockchain data with WinScan",
      keywords: ["WinScan", "blockchain explorer", "crypto explorer"],
      openGraph: {
        title: "WinScan — Blockchain Explorer",
        description: "Explore blockchain data with WinScan",
        type: "website",
      },
    };
  }
}

export default function Layout({ children }: Props) {
  return <>{children}</>;
}
