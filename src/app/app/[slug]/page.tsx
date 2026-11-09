import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function RestaurantIndex({ params }: PageProps<"/app/[slug]">) {
  return (
    <Suspense>
      <Doorsturen params={params} />
    </Suspense>
  );
}

async function Doorsturen({ params }: Pick<PageProps<"/app/[slug]">, "params">): Promise<never> {
  const { slug } = await params;
  redirect(`/app/${slug}/dashboard`);
}
