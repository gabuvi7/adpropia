export function StatusCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <article className="bg-card border border-border rounded-xl p-5">
      <p className="text-muted-foreground m-0">{label}</p>
      <strong className="block text-[28px] mt-2">{value}</strong>
    </article>
  );
}
