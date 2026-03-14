export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/201060306803"
      target="_blank"
      rel="noopener noreferrer"
      title="تواصل معنا على واتساب"
      className="fixed bottom-6 left-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] shadow-lg hover:bg-[#20bd5a] transition-colors duration-200"
      aria-label="تواصل معنا على واتساب"
    >
      {/* WhatsApp icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        fill="white"
        className="w-8 h-8"
      >
        <path d="M16 3C8.82 3 3 8.82 3 16c0 2.34.64 4.63 1.85 6.63L3 29l6.54-1.81A13 13 0 0016 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.85a10.84 10.84 0 01-5.54-1.52l-.4-.24-4.13 1.14 1.1-4.03-.26-.42A10.85 10.85 0 015.15 16C5.15 9.99 10 5.15 16 5.15S26.85 9.99 26.85 16 22.01 26.85 16 26.85zm6-8.13c-.33-.16-1.94-.96-2.24-1.07-.3-.1-.52-.16-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.16-1.39-.51-2.65-1.63-.98-.87-1.64-1.95-1.83-2.28-.19-.33-.02-.5.14-.67.15-.14.33-.38.5-.57.16-.19.22-.33.33-.55.1-.22.05-.41-.03-.57-.08-.16-.74-1.78-1.01-2.44-.27-.64-.54-.55-.74-.56h-.63c-.22 0-.57.08-.87.41-.3.33-1.14 1.11-1.14 2.71s1.17 3.14 1.33 3.36c.16.22 2.3 3.52 5.58 4.93.78.34 1.39.54 1.87.69.78.25 1.5.21 2.06.13.63-.09 1.94-.79 2.21-1.56.28-.77.28-1.42.19-1.56-.08-.14-.3-.22-.63-.38z" />
      </svg>

      {/* Pulse animation ring */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30 pointer-events-none" />
    </a>
  );
}
