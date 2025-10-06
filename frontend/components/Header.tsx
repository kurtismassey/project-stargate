import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <Link
      href="/"
      className="flex flex-row items-center justify-center uppercase cursor-pointer hover:opacity-80 transition-opacity"
    >
      <h1 className="text-2xl font-extrabold">Project</h1>
      <Image
        src="/logo.png"
        alt="Project Stargate"
        width={40}
        height={40}
        priority
      />
      <h1 className="text-2xl font-extrabold">Stargate</h1>
    </Link>
  );
}
