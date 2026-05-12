import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("nanea_session");

  if (session?.value === "authenticated") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          Nanea Homes
        </h1>
        <p className="mt-2 text-lg font-medium text-blue-600">
          Rental Property Management
        </p>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Streamline your rental property operations. Track properties, manage
          finances, coordinate with contractors, and keep everything organized
          in one place.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
