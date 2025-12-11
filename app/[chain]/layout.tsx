import { Metadata } from "next";

interface Props {
  children: React.ReactNode;
  params: { chain: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const chain = params.chain;

  // fetch chain data using route param
  const res = await fetch(`https://winscan.winsnip.xyz/api/chains`, {
    cache: "no-store",
  });
  const chains = await res.json();

  const selected = chains.find(
    (c: any) =>
      c.chain_name.toLowerCase().replace(/\s+/g, "-") === chain.toLowerCase()
  );

  const chain_name = selected.chain_name
    .split("-")
    .map(
      (content: string) => content.charAt(0).toUpperCase() + content.slice(1)
    )
    .join(" ");
  const title = selected
    ? `${chain_name} Explorer — WinScan`
    : "Chain Overview - WinScan";

  const description = `Winscan allows you to explore and search the ${chain_name} blockchain for transactions, addresses, tokens, prices and other activities taking place on ${chain_name}`;

  const image = selected?.logo ?? "/logo.svg";

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
}

export default function Layout({ children }: Props) {
  return <>{children}</>;
}
