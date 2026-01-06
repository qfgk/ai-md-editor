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
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher scale for better quality
      logging: false,
      useCORS: true,
    });

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
 * Export content as PDF
 */
export async function exportToPDF(
  element: HTMLElement,
  filename: string = 'document.pdf'
): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    });

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

    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if content is longer than one page
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
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
