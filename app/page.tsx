import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Image src="/next.svg" alt="Next.js Logo" width={180} height={37} priority />
      <p className="text-center text-gray-500">Get started by editing app/page.tsx</p>
    </main>
  );
}
