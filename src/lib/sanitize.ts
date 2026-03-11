/**
 * Lightweight HTML sanitizer using browser's native DOM API.
 * Removes <script> tags, inline event handlers (on*), and javascript: hrefs.
 * Only runs in the browser — returns html as-is during SSR (build-time data is trusted).
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return html;
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html;

  // Remove all <script> and <style> tags
  doc.body.querySelectorAll('script, iframe, object, embed, form').forEach(el => el.remove());

  // Strip event handlers and dangerous attributes from every element
  doc.body.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      const value = attr.value.toLowerCase().replace(/\s/g, '');
      if (
        name.startsWith('on') ||                        // onclick, onerror, etc.
        (name === 'href' && (value.startsWith('javascript:') || value.startsWith('data:'))) ||
        (name === 'src'  && value.startsWith('javascript:')) ||
        name === 'srcdoc'
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}
