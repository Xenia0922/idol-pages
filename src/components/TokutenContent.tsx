import { useState, useEffect } from 'react';

interface Cfg {
  tokuten_rules?: string[];
  tokuten_images?: string[];
  weibo?: string;
  weibo_name?: string;
}

export default function TokutenContent({ initial }: { initial: Cfg }) {
  const ssr = typeof window !== 'undefined' ? (window as any).__SSR_DATA__ : null;
  const [cfg, setCfg] = useState<Cfg>(() => ({ ...(initial || {}), ...(ssr?.siteConfig || {}) }));

  useEffect(() => {
    if (ssr?.siteConfig) return;
    let alive = true;
    fetch('/api/site')
      .then(r => r.json())
      .then(d => { if (alive && d) setCfg(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const images = cfg.tokuten_images || [];
  const rules = cfg.tokuten_rules || [];

  return (
    <>
      {images.map((img, i) => (
        <div
          className="card overflow-hidden mb-8"
          key={i}
          data-reveal
          style={{ ['--reveal-delay' as any]: `${i * 70}ms` }}
        >
          <img src={img} alt="物贩详情/集章细则" className="w-full" loading="lazy" />
        </div>
      ))}

      <div
        className="card p-8 mb-8"
        data-reveal
        style={{ ['--reveal-delay' as any]: `${images.length * 70}ms` }}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">✦ 文字规则</h2>
        <ol className="space-y-3">
          {rules.map((rule, i) => (
            <li className="flex gap-3" key={i}>
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-500 text-sm font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-gray-700 dark:text-gray-300 pt-0.5">{rule}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
