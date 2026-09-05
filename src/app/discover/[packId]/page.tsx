import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPackById, PACKS } from "@/data/content";
import { PackDetail } from "@/components/discover/pack-detail";

export function generateStaticParams() { return PACKS.map((pack) => ({ packId: pack.id })); }
export async function generateMetadata({ params }: { params: Promise<{ packId: string }> }): Promise<Metadata> {
  const { packId } = await params;
  const pack = getPackById(packId);
  return pack ? { title: pack.name, description: pack.description } : {};
}
export default async function PackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  const pack = getPackById(packId);
  if (!pack) notFound();
  return <PackDetail pack={pack} />;
}
