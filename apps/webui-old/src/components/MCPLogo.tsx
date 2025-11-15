export function MCPLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="24" height="24" rx="6" fill="url(#mcp-gradient)" />
      <path
        d="M7 8L12 5L17 8V16L12 19L7 16V8Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="12" cy="12" r="2" fill="white" />
      <defs>
        <linearGradient id="mcp-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5ac8fa" />
          <stop offset="1" stopColor="#0a84ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}
