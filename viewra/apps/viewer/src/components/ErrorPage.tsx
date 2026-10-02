type ErrorPageProps = {
  status: number;
  message?: string;
};

export function ErrorPage({ status, message }: ErrorPageProps) {
  const archived = status === 410;
  const title = archived ? "Unavailable" : "Not found";
  const body =
    message ||
    (archived
      ? "This tour is no longer available."
      : "This tour could not be found or is not published yet.");

  return (
    <main
      className="flex min-h-full flex-col items-center justify-center px-6 text-center"
      data-testid={archived ? "archived-page" : "not-found-page"}
    >
      <p className="font-display text-5xl tracking-tight text-mist-100 md:text-6xl">
        Viewra
      </p>
      <h1 className="mt-10 font-display text-3xl italic text-mist-200">{title}</h1>
      <p className="mt-3 max-w-md text-sm font-light leading-relaxed text-mist-300">
        {body}
      </p>
    </main>
  );
}
