"use client";

export function ImagesGrid({ images }: { images: string[] }) {
  if (!images || images.length === 0) {
    return <p className="text-sm text-text-secondary">Nenhuma imagem encontrada.</p>;
  }
  return (
    <div className="grid max-h-[520px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
      {images.map((src, index) => (
        <a
          key={`${src}-${index}`}
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="group overflow-hidden rounded-lg border border-border bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title={src}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote, unbounded set of external hosts */}
          <img
            src={src}
            alt={`Imagem capturada ${index + 1}`}
            loading="lazy"
            className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
          />
        </a>
      ))}
    </div>
  );
}
