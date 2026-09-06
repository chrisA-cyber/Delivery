import { JoinCode } from "@/components/rounds/join-code";
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  return <JoinCode initialCode={(await searchParams).code ?? ""} />;
}
