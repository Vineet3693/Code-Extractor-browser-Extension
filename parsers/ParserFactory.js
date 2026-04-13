(function () {
  'use strict';

  if (typeof window.ParserFactory === 'undefined') {
    window.ParserFactory = class ParserFactory {
      constructor() {
        this.parserMap = [
          { pattern: /chat\.openai\.com|chatgpt\.com/, Parser: ChatGPTParser },
          { pattern: /claude\.ai/, Parser: ClaudeParser },
          { pattern: /gemini\.google\.com/, Parser: GeminiParser },
          { pattern: /app\.outlier\.ai|\.outlier\.ai/, Parser: OutlierParser },
          { pattern: /chat\.mistral\.ai/, Parser: MistralParser },
          { pattern: /^https?:\/\/poe\.com/, Parser: PoeParser },
          { pattern: /github\.com/, Parser: GitHubParser },
          { pattern: /stackoverflow\.com/, Parser: StackOverflowParser }
        ];
      }

      getParser(url) {
        for (const { pattern, Parser } of this.parserMap) {
          if (pattern.test(url)) {
            return new Parser();
          }
        }
        return new GenericParser();
      }

      detectSite(url) {
        if (/chat\.openai\.com|chatgpt\.com/.test(url)) return "ChatGPT";
        if (/claude\.ai/.test(url)) return "Claude";
        if (/gemini\.google\.com/.test(url)) return "Gemini";
        if (/app\.outlier\.ai|\.outlier\.ai/.test(url)) return "Outlier";
        if (/chat\.mistral\.ai/.test(url)) return "Mistral";
        if (/^https?:\/\/poe\.com/.test(url)) return "Poe";
        if (/github\.com/.test(url)) return "GitHub";
        if (/stackoverflow\.com/.test(url)) return "Stack Overflow";
        return "Generic";
      }

      registerParser(urlPattern, ParserClass) {
        this.parserMap.unshift({ pattern: urlPattern, Parser: ParserClass });
      }
    };
  }

  const factory = new window.ParserFactory();
  window.getParser = factory.getParser.bind(factory);
  window.detectSite = factory.detectSite.bind(factory);
  window.registerParser = factory.registerParser.bind(factory);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { getParser: window.getParser, detectSite: window.detectSite, registerParser: window.registerParser, GenericParser };
  }
})();
