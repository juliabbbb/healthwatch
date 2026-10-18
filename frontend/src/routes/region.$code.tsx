import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/region/$code")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/seasonality", search: { region: params.code } });
  },
});
