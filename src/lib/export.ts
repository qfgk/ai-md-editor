import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { marked } from 'marked';

/**
 * Export content as PNG image
 */
export async function exportToPNG(
  element: HTMLElement,
  filename: string = 'document.png'
): Promise<void> {
  try {
    // Create a wrapper with fixed width for consistent export
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.width = '1200px'; // Fixed width for consistent exports
    wrapper.style.minHeight = 'auto';
    wrapper.style.height = 'auto';
    wrapper.style.background = '#ffffff';
    wrapper.style.padding = '40px';
    wrapper.style.overflow = 'visible';
    wrapper.className = element.className;
    wrapper.innerHTML = element.innerHTML;

    document.body.appendChild(wrapper);

    // Force layout recalculation to get full height
    wrapper.style.height = wrapper.scrollHeight + 'px';

    const canvas = await html2canvas(wrapper, {
      backgroundColor: '#ffffff',
      scale: 1, // Normal resolution
      logging: false,
      useCORS: true,
      ignoreElements: (element) => false,
      windowWidth: 1200,
      windowHeight: wrapper.scrollHeight,
      onclone: (clonedDoc) => {
        const root = clonedDoc.documentElement;
        root.style.setProperty('color-scheme', 'light');

        const style = clonedDoc.createElement('style');
        style.textContent = `
          * {
            color: #000000 !important;
            background-color: transparent !important;
            border-color: #e5e7eb !important;
          }
          body, div, span, p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, code {
            color: #000000 !important;
          }
          a {
            color: #2563eb !important;
          }
          code, pre {
            background-color: #f3f4f6 !important;
            border: 1px solid #e5e7eb !important;
          }
          blockquote {
            border-color: #2563eb !important;
            color: #6b7280 !important;
          }
          table {
            border-color: #e5e7eb !important;
          }
          th, td {
            border-color: #e5e7eb !important;
            color: #000000 !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      }
    });

    document.body.removeChild(wrapper);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  } catch (error) {
    console.error('PNG export failed:', error);
    throw new Error('PNG 导出失败');
  }
}

/**
 * Export content as PDF using browser print (Typora-quality)
 * This provides the best pagination and formatting
 */
export function exportToPDFWithPrint(markdown: string, documentFilename?: string): void {
  try {
    // Extract title from markdown or use filename
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    let title = titleMatch ? titleMatch[1].trim() : '文档';

    // If filename is provided and different from default, use it
    if (documentFilename && documentFilename !== 'document.md') {
      title = documentFilename.replace(/\.md$/i, '');
    }

    // Clean title - remove invalid characters
    title = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('无法打开打印窗口，请检查浏览器弹窗设置');
    }

    // Convert markdown to HTML
    const htmlContent = marked(markdown);

    // Write the print document with proper styling
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000000;
            background: #ffffff;
            max-width: 210mm;
            margin: 0 auto;
            padding: 8mm;
            padding-top: calc(8mm + 50px); /* Space for banner */
          }

          @media print {
            body {
              padding: 8mm; /* Remove banner space when printing */
            }
          }

          /* 打印提示横幅 */
          .print-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            text-align: center;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }

          .print-banner strong {
            margin-right: 8px;
          }

          @media print {
            .print-banner {
              display: none;
            }
          }

          h1, h2, h3, h4, h5, h6 {
            font-weight: 600;
            margin-top: 1.2em;
            margin-bottom: 0.4em;
            page-break-after: avoid;
          }

          h1 { font-size: 2em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
          h2 { font-size: 1.5em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
          h3 { font-size: 1.25em; }
          h4 { font-size: 1em; }
          h5 { font-size: 0.875em; }
          h6 { font-size: 0.75em; }

          p {
            margin-bottom: 0.8em;
            line-height: 1.5;
          }

          a {
            color: #2563eb;
            text-decoration: none;
          }

          code {
            font-family: 'Courier New', Courier, monospace;
            background-color: #f3f4f6;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-size: 0.9em;
          }

          pre {
            background-color: #f8f9fa;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 1em;
            overflow-x: auto;
            page-break-inside: avoid;
            margin-bottom: 0.8em;
            max-height: 600px;
            overflow-y: auto;
          }

          pre code {
            background-color: transparent;
            padding: 0;
            border: none;
            font-size: 0.9em;
          }

          blockquote {
            border-left: 4px solid #2563eb;
            padding-left: 1em;
            margin-left: 0;
            margin-right: 0;
            color: #6b7280;
            font-style: italic;
            margin-bottom: 0.8em;
          }

          ul, ol {
            margin-left: 2em;
            margin-bottom: 0.8em;
          }

          li {
            margin-bottom: 0.3em;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0.8em;
            page-break-inside: avoid;
          }

          th, td {
            border: 1px solid #e5e7eb;
            padding: 0.5em;
            text-align: left;
          }

          th {
            background-color: #f9fafb;
            font-weight: 600;
          }

          hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 2em 0;
            page-break-after: always;
          }

          img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1em auto;
            page-break-inside: avoid;
          }

          /* 只有代码块、表格、图片避免分页切断 */
          pre, table, img {
            break-inside: avoid;
          }

          /* 标题避免在页面底部孤立 */
          h1, h2, h3, h4, h5, h6 {
            break-after: avoid;
          }

          /* 允许段落跨页，但避免孤行 */
          p {
            orphans: 2;
            widows: 2;
          }

          @media print {
            body {
              padding: 8mm;
            }
            .print-banner {
              display: none;
            }

            /* 设置页面边距，同时移除浏览器默认的页眉页脚 */
            @page {
              margin: 8mm;
              size: A4;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-banner">
          <strong>💡 提示：</strong>请在打印对话框中选择「另存为 PDF」作为目标，然后点击保存
        </div>
        ${htmlContent}
        <script>
          // Trigger print dialog when page loads
          window.onload = function() {
            setTimeout(function() {
              window.print();
              // Close window after printing (user may cancel)
              setTimeout(function() {
                window.close();
              }, 1000);
            }, 500);
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error('PDF 导出失败');
  }
}

/**
 * Export content as PDF
 */
export async function exportToPDF(
  element: HTMLElement,
  filename: string = 'document.pdf'
): Promise<void> {
  try {
    // Create a wrapper with fixed width for consistent exports
    const A4_WIDTH_MM = 210;
    const MM_TO_PX = 3.7795;
    const A4_WIDTH_PX = Math.round(A4_WIDTH_MM * MM_TO_PX);

    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.width = `${A4_WIDTH_PX}px`;
    wrapper.style.minHeight = 'auto';
    wrapper.style.height = 'auto';
    wrapper.style.background = '#ffffff';
    wrapper.style.padding = '40px';
    wrapper.style.fontSize = '16px';
    wrapper.style.lineHeight = '1.6';
    wrapper.style.overflow = 'visible';
    wrapper.className = element.className;
    wrapper.innerHTML = element.innerHTML;

    document.body.appendChild(wrapper);
    wrapper.style.height = wrapper.scrollHeight + 'px';

    const canvas = await html2canvas(wrapper, {
      backgroundColor: '#ffffff',
      scale: 1,
      logging: false,
      useCORS: true,
      ignoreElements: (element) => false,
      windowWidth: A4_WIDTH_PX,
      windowHeight: wrapper.scrollHeight,
      onclone: (clonedDoc) => {
        const root = clonedDoc.documentElement;
        root.style.setProperty('color-scheme', 'light');

        const style = clonedDoc.createElement('style');
        style.textContent = `
          * {
            color: #000000 !important;
            background-color: transparent !important;
            border-color: #e5e7eb !important;
          }
          body, div, span, p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, code {
            color: #000000 !important;
          }
          a {
            color: #2563eb !important;
          }
          code, pre {
            background-color: #f3f4f6 !important;
            border: 1px solid #e5e7eb !important;
          }
          blockquote {
            border-color: #2563eb !important;
            color: #6b7280 !important;
          }
          table {
            border-color: #e5e7eb !important;
          }
          th, td {
            border-color: #e5e7eb !important;
            color: #000000 !important;
          }
          /* Avoid breaking inside these elements */
          h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table, li {
            break-inside: avoid !important;
          }
          pre, code {
            white-space: pre-wrap !important;
            word-break: break-word !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      }
    });

    document.body.removeChild(wrapper);

    // Convert canvas to image data
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    // Calculate total pages needed
    const totalPages = Math.ceil(imgHeight / pageHeight);

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      // Calculate Y position to show the correct portion of the image
      const yPosition = -(i * pageHeight);
      pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, imgHeight);
    }

    pdf.save(filename);
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error('PDF 导出失败');
  }
}

/**
 * Convert Markdown to DOCX
 */
export async function exportToDOCX(
  markdown: string,
  filename: string = 'document.docx'
): Promise<void> {
  try {
    const tokens = marked.lexer(markdown);
    const docChildren: any[] = [];

    tokens.forEach((token) => {
      switch (token.type) {
        case 'heading':
          const level = token.depth as 1 | 2 | 3 | 4 | 5 | 6;
          const headingLevel = `HEADING_${level}` as keyof typeof HeadingLevel;
          docChildren.push(
            new Paragraph({
              text: token.text,
              heading: HeadingLevel[headingLevel.replace('HEADING_', '') as unknown as 1 | 2 | 3 | 4 | 5 | 6],
              spacing: {
                before: 240,
                after: 120,
              },
            })
          );
          break;

        case 'paragraph':
          // Handle bold, italic, and other inline formatting
          const textRuns = extractTextRuns(token.text);
          docChildren.push(
            new Paragraph({
              children: textRuns,
              spacing: {
                after: 120,
              },
            })
          );
          break;

        case 'code':
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: token.text,
                  font: 'Courier New',
                  size: 20,
                }),
              ],
              shading: {
                fill: 'F5F5F5',
              },
              spacing: {
                before: 120,
                after: 120,
              },
            })
          );
          break;

        case 'blockquote':
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: token.text,
                  italics: true,
                  color: '666666',
                }),
              ],
              indent: {
                left: 720,
              },
              spacing: {
                before: 120,
                after: 120,
              },
            })
          );
          break;

        case 'list':
          token.items.forEach((item: string) => {
            docChildren.push(
              new Paragraph({
                text: item,
                bullet: {
                  level: 0,
                },
                spacing: {
                  after: 60,
                },
              })
            );
          });
          break;

        case 'hr':
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '',
                  border: {
                    bottom: {
                      color: '000000',
                      space: 1,
                      value: 'single',
                      size: 6,
                    },
                  },
                }),
              ],
              spacing: {
                before: 120,
                after: 120,
              },
            })
          );
          break;

        default:
          if (token.raw) {
            docChildren.push(
              new Paragraph({
                text: token.raw,
                spacing: {
                  after: 120,
                },
              })
            );
          }
          break;
      }
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('DOCX export failed:', error);
    throw new Error('DOCX 导出失败');
  }
}

/**
 * Extract text runs with formatting (bold, italic, code)
 */
function extractTextRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let remainingText = text;

  // Pattern for inline code
  const codePattern = /`([^`]+)`/g;
  // Pattern for bold
  const boldPattern = /\*\*([^*]+)\*\*/g;
  // Pattern for italic
  const italicPattern = /\*([^*]+)\*/g;
  // Pattern for links
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

  // Simple implementation - split by formatting patterns
  let lastIndex = 0;
  const patterns = [
    { regex: codePattern, format: 'code' },
    { regex: boldPattern, format: 'bold' },
    { regex: italicPattern, format: 'italic' },
    { regex: linkPattern, format: 'link' },
  ];

  // For now, just return the text as a single run
  // TODO: Implement proper parsing for nested formatting
  runs.push(
    new TextRun({
      text: text,
    })
  );

  return runs;
}
