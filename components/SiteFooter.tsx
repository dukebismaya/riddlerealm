import React, { useMemo } from 'react';

interface SiteFooterProps {
  className?: string;
}

const DEVELOPER_NAME = 'Bismaya';
const githubUrl = 'https://github.com/dukebismaya';
const linkedinUrl = 'https://www.linkedin.com/in/bismaya-jyoti-d-74692a328';

const SiteFooter: React.FC<SiteFooterProps> = ({ className }) => {
  const developerNameLetters = useMemo(() => DEVELOPER_NAME.split(''), []);

  return (
    <footer className={`w-full text-center text-xs md:text-sm text-slate-400 ${className ?? ''}`}>
      <div className="flex flex-wrap justify-center gap-3 text-xs md:text-sm text-slate-500 mb-5">
        <button
          type="button"
          disabled
          className="rounded-full border border-white/5 px-3 py-1.5 opacity-60 cursor-not-allowed"
          aria-disabled="true"
        >
          Privacy Policy
        </button>
        <button
          type="button"
          disabled
          className="rounded-full border border-white/5 px-3 py-1.5 opacity-60 cursor-not-allowed"
          aria-disabled="true"
        >
          About
        </button>
        <button
          type="button"
          disabled
          className="rounded-full border border-white/5 px-3 py-1.5 opacity-60 cursor-not-allowed"
          aria-disabled="true"
        >
          Terms &amp; Conditions
        </button>
        <a
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-cyan-400/40 px-3 py-1.5 text-cyan-200 hover:bg-cyan-500/10 transition"
        >
          GitHub
        </a>
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-cyan-400/40 px-3 py-1.5 text-cyan-200 hover:bg-cyan-500/10 transition"
        >
          LinkedIn
        </a>
      </div>
      <div>
        <span className="opacity-80">Developed By </span>
        <span className="developer-mark" aria-label={DEVELOPER_NAME}>
          <span className="sr-only">{DEVELOPER_NAME}</span>
          {developerNameLetters.map((char, index) => (
            <span key={`developer-letter-${index}`} className="developer-letter" aria-hidden="true">
              <span className="developer-letter-inner">{char}</span>
            </span>
          ))}
        </span>
      </div>
    </footer>
  );
};

export default SiteFooter;
