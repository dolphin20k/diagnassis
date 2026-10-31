import Image from "next/image";

export function Logo({ height = 40, priority }: { height?: number; priority?: boolean }) {
  return <Image src="/brand/logo.png" alt="DIAGNASSIS" width={Math.round(height * 2.4)} height={height} priority={priority} style={{ height, width: "auto" }} />;
}
