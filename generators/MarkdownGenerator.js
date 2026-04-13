if (typeof window.MarkdownGenerator === 'undefined') {
    window.MarkdownGenerator = class MarkdownGenerator {

        /**
         * Generates a single markdown document representing the entire project.
         * @param {Object} project - Project object containing name, sourceUrl, files
         * @returns {string} - Markdown formatted string
         */
        static generateProjectMarkdown(project) {
            const files = project.files || [];
            let md = `# ${project.name || 'Extracted Project'}\n\n`;

            if (project.sourceUrl) {
                md += `> Extracted using Code Extractor V3.0 from: ${project.sourceUrl}\n\n`;
            }

            md += `## Project Statistics\n`;
            md += `- **Files:** ${files.length}\n`;
            const totalLines = files.reduce((acc, f) => acc + (f.content || '').split('\n').length, 0);
            md += `- **Total Lines:** ${totalLines}\n\n`;

            md += `## Project Structure\n\n`;
            md += '```text\n';
            md += this._generateTreeText(files);
            md += '```\n\n';

            md += `## Files\n\n`;

            // Sort files to generate markdown in alphabetical order
            const sortedFiles = [...files].sort((a, b) => {
                const pathA = (a.path || a.fileName || '').toLowerCase();
                const pathB = (b.path || b.fileName || '').toLowerCase();
                return pathA.localeCompare(pathB);
            });

            for (const file of sortedFiles) {
                const fileName = file.path || file.fileName || 'unknown.txt';
                const lang = file.language || '';

                md += `### \`${fileName}\`\n\n`;
                if (file.description) {
                    md += `*${file.description}*\n\n`;
                }

                md += '```' + lang + '\n';
                md += (file.content || '').trim() + '\n';
                md += '```\n\n';
            }

            return md;
        }

        /**
         * Internal helper to generate a text-based tree view for the markdown file
         */
        static _generateTreeText(files) {
            const entries = files.map(f => f.path || f.fileName || 'unknown.txt').sort();
            return entries.map(p => `  ${p}`).join('\n') + '\n';
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MarkdownGenerator: window.MarkdownGenerator };
}
