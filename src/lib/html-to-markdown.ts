/**
 * Convert HTML content to Markdown format
 * This handles rich text paste from web browsers
 */

interface ConversionOptions {
  // Preserve inline formatting (bold, italic, etc.)
  preserveFormatting?: boolean;
  // Convert links to markdown format
  convertLinks?: boolean;
  // Convert images to markdown format
  convertImages?: boolean;
  // Preserve list structure
  convertLists?: boolean;
  // Preserve headings
  convertHeadings?: boolean;
  // Callback to handle image uploads
  onImageFound?: (imageUrl: string) => Promise<string>;
}

/**
 * Convert HTML string to Markdown (async version for image handling)
 */
export async function htmlToMarkdownAsync(
  html: string,
  options: ConversionOptions = {}
): Promise<string> {
  const {
    preserveFormatting = true,
    convertLinks = true,
    convertImages = true,
    convertLists = true,
    convertHeadings = true,
    onImageFound,
  } = options;

  // Create a temporary DOM element to parse HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  // Collect images to upload
  const imagePromises: Promise<void>[] = [];
  const imageMap = new Map<string, string>(); // original URL -> uploaded URL

  if (onImageFound && convertImages) {
    const images = tmp.querySelectorAll('img');
    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('http')) {
        const promise = (async () => {
          try {
            const uploadedUrl = await onImageFound(src);
            imageMap.set(src, uploadedUrl);
            img.setAttribute('src', uploadedUrl);
            img.setAttribute('data-uploaded', 'true');
          } catch (error) {
            console.error('Failed to upload image:', error);
            // Keep original URL if upload fails
          }
        })();
        imagePromises.push(promise);
      }
    });

    // Wait for all images to upload
    await Promise.all(imagePromises);
  }

  // Now convert to markdown
  let markdown = '';

  // Process child nodes
  tmp.childNodes.forEach((node) => {
    markdown += processNode(node, options);
  });

  // Clean up multiple blank lines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  return markdown.trim();
}

/**
 * Convert HTML string to Markdown (sync version without image upload)
 */
export function htmlToMarkdown(
  html: string,
  options: ConversionOptions = {}
): string {
  const {
    preserveFormatting = true,
    convertLinks = true,
    convertImages = true,
    convertLists = true,
    convertHeadings = true,
  } = options;

  // Create a temporary DOM element to parse HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = html;

  let markdown = '';

  // Process child nodes
  tmp.childNodes.forEach((node) => {
    markdown += processNode(node, options);
  });

  // Clean up multiple blank lines
  markdown = markdown.replace(/\n{3,}/g, '\n\n');

  return markdown.trim();
}

/**
 * Process a DOM node and convert to markdown
 */
function processNode(
  node: Node,
  options: ConversionOptions
): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      if (!options.convertHeadings) {
        return processChildren(element, options);
      }
      const level = parseInt(tagName[1]);
      const headingText = processChildren(element, { ...options, convertHeadings: false });
      return `\n\n${'#'.repeat(level)} ${headingText.trim()}\n\n`;

    case 'p':
      const text = processChildren(element, options);
      return text.trim() ? `\n\n${text}\n\n` : '\n';

    case 'br':
      return '\n';

    case 'b':
    case 'strong':
      if (!options.preserveFormatting) {
        return processChildren(element, options);
      }
      return `**${processChildren(element, options)}**`;

    case 'i':
    case 'em':
      if (!options.preserveFormatting) {
        return processChildren(element, options);
      }
      return `*${processChildren(element, options)}*`;

    case 'u':
    case 'ins':
      return `<u>${processChildren(element, options)}</u>`;

    case 's':
    case 'del':
      return `~~${processChildren(element, options)}~~`;

    case 'code':
      return `\`${element.textContent}\``;

    case 'pre':
      const codeElement = element.querySelector('code');
      const code = codeElement?.textContent || element.textContent || '';
      const language = codeElement?.className.match(/language-(\w+)/)?.[1] || '';
      return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;

    case 'a':
      if (!options.convertLinks) {
        return processChildren(element, options);
      }
      const href = element.getAttribute('href') || '';
      const linkText = processChildren(element, { ...options, convertLinks: false });
      return href ? `[${linkText}](${href})` : linkText;

    case 'img':
      if (!options.convertImages) {
        return '';
      }
      const src = element.getAttribute('src') || '';
      const alt = element.getAttribute('alt') || '';
      return src ? `![${alt}](${src})` : '';

    case 'ul':
    case 'ol':
      if (!options.convertLists) {
        return processChildren(element, options);
      }
      return convertList(element, options);

    case 'li':
      // List items are handled by convertList
      return processChildren(element, options);

    case 'blockquote':
      const quoteText = processChildren(element, options)
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n');
      return `\n\n${quoteText}\n\n`;

    case 'hr':
      return '\n\n---\n\n';

    case 'div':
    case 'span':
    case 'section':
    case 'article':
    case 'header':
    case 'footer':
    case 'main':
    case 'aside':
      // Block elements - add spacing
      return processChildren(element, options);

    case 'table':
      return convertTable(element, options);

    case 'tr':
    case 'td':
    case 'th':
    case 'thead':
    case 'tbody':
      // Table elements are handled by convertTable
      return processChildren(element, options);

    default:
      // Unknown elements - just process children
      return processChildren(element, options);
  }
}

/**
 * Process all child nodes of an element
 */
function processChildren(element: Element, options: ConversionOptions): string {
  return Array.from(element.childNodes)
    .map(child => processNode(child, options))
    .join('');
}

/**
 * Convert list (ul/ol) to markdown
 */
function convertList(element: Element, options: ConversionOptions): string {
  const tagName = element.tagName.toLowerCase();
  const isOrdered = tagName === 'ol';
  const items = Array.from(element.querySelectorAll(':scope > li'));

  let markdown = '\n';

  items.forEach((item, index) => {
    const itemText = processChildren(item, {
      ...options,
      convertLists: false, // Don't convert nested lists here
    }).trim();

    if (isOrdered) {
      markdown += `${index + 1}. ${itemText}\n`;
    } else {
      // Check if it's a task list
      const isFirstCheckbox = item.querySelector('input[type="checkbox"]');
      if (isFirstCheckbox) {
        const checked = isFirstCheckbox instanceof HTMLInputElement && isFirstCheckbox.checked;
        // Remove the checkbox from text
        const textWithoutCheckbox = itemText.replace(/\[([ x])\]/, '').trim();
        markdown += `- [${checked ? 'x' : ' '}] ${textWithoutCheckbox}\n`;
      } else {
        markdown += `- ${itemText}\n`;
      }
    }

    // Handle nested lists
    const nestedList = item.querySelector('ul, ol');
    if (nestedList) {
      // Remove nested list from itemText and add it separately
      const nestedMarkdown = convertList(nestedList, options);
      markdown += nestedMarkdown.split('\n').map(line => '  ' + line).join('\n') + '\n';
    }
  });

  markdown += '\n';
  return markdown;
}

/**
 * Convert table to markdown
 */
function convertTable(element: Element, options: ConversionOptions): string {
  const rows = Array.from(element.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  let markdown = '\n';

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    const cellTexts = cells.map(cell =>
      processChildren(cell, options).trim().replace(/\|/g, '\\|')
    );

    markdown += `| ${cellTexts.join(' | ')} |\n`;

    // Add separator after header row
    if (rowIndex === 0 && row.parentElement?.tagName === 'THEAD') {
      const separator = cells.map(() => '---').join(' | ');
      markdown += `| ${separator} |\n`;
    }
  });

  markdown += '\n';
  return markdown;
}

/**
 * Extract HTML from clipboard event
 */
export function getHTMLFromClipboard(event: ClipboardEvent): string | null {
  const htmlData = event.clipboardData?.getData('text/html');
  return htmlData || null;
}

/**
 * Extract plain text from clipboard event
 */
export function getTextFromClipboard(event: ClipboardEvent): string | null {
  const textData = event.clipboardData?.getData('text/plain');
  return textData || null;
}

/**
 * Download image from URL and convert to File
 */
export async function downloadImageAsFile(imageUrl: string): Promise<File> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const blob = await response.blob();

  // Extract filename from URL
  const url = new URL(imageUrl);
  const filename = url.pathname.split('/').pop() || 'image';
  const extension = blob.type.split('/')[1] || 'png';

  return new File([blob], `${filename}.${extension}`, { type: blob.type });
}
