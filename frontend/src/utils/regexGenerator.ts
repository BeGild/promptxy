/**
 * 正则表达式结果类型
 */
export interface RegexResult {
  /** 正则表达式模式 */
  pattern: string;
  /** 正则表达式标志位 */
  flags: string;
  /** 完整的正则表达式字符串（用于显示） */
  display: string;
}

/**
 * 匹配模式枚举
 */
export enum MatchMode {
  EXACT = 'exact',
  PREFIX = 'prefix',
  SUFFIX = 'suffix',
  HEAD_TAIL = 'head_tail', // 头尾匹配：使用开头和结尾各 N 个字符
  CONTAINS = 'contains',
  WHOLE_WORD = 'whole_word',
  BASED_ON_REQUEST = 'based_on_request',
}

/**
 * 正则表达式生成工具类
 * 用于根据用户选中的文本和匹配模式自动生成正则表达式
 */
export class RegexGenerator {
  /**
   * 需要转义的正则特殊字符
   */
  private static readonly SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

  /**
   * 转义正则表达式中的特殊字符
   * @param text 原始文本
   * @returns 转义后的文本
   */
  static escapeRegex(text: string): string {
    // 先转义换行符等控制字符
    let escaped = text
      .replace(/\n/g, '\\n')   // 换行符
      .replace(/\r/g, '\\r')   // 回车符
      .replace(/\t/g, '\\t');  // 制表符
    // 再转义正则表达式特殊字符
    return escaped.replace(this.SPECIAL_CHARS, '\\$&');
  }

  /**
   * 判断文本是否为纯 ASCII
   * 用于决定全词语匹配是否使用 \b 边界
   * @param text 输入文本
   * @returns 是否为纯 ASCII
   */
  private static isPureAscii(text: string): boolean {
    return /^[\x00-\x7F]*$/.test(text);
  }

  /**
   * 构建 flags 字符串
   * @param ignoreCase 是否忽略大小写
   * @param multiline 是否多行模式
   * @returns flags 字符串
   */
  private static buildFlags(ignoreCase: boolean, multiline: boolean): string {
    const flags = [];
    if (ignoreCase) flags.push('i');
    if (multiline) flags.push('m');
    return flags.join('');
  }

  /**
   * 构建 display 字符串
   * @param pattern 正则模式
   * @param flags flags 字符串
   * @returns display 字符串
   */
  private static buildDisplay(pattern: string, flags: string): string {
    if (flags) {
      return `/${pattern}/${flags}`;
    }
    return pattern;
  }

  /**
   * 生成完整匹配正则表达式 (^text$)
   * @param text 原始文本
   * @param ignoreCase 是否忽略大小写
   * @param multiline 是否多行模式
   * @returns 正则表达式结果
   */
  static generateExactMatch(text: string, ignoreCase = false, multiline = false): RegexResult {
    const escaped = this.escapeRegex(text);
    const pattern = `^${escaped}$`;
    const flags = this.buildFlags(ignoreCase, multiline);
    return {
      pattern,
      flags,
      display: this.buildDisplay(pattern, flags),
    };
  }

  /**
   * 生成前缀匹配正则表达式 (^text.*$)
   * 匹配以指定文本开头的整行
   * @param text 原始文本
   * @param ignoreCase 是否忽略大小写
   * @param multiline 是否多行模式
   * @returns 正则表达式结果
   */
  static generatePrefixMatch(text: string, ignoreCase = false, multiline = false): RegexResult {
    const escaped = this.escapeRegex(text);
    // 多行模式使用 [\s\S]* 来匹配包括换行符在内的所有字符
    const wildcard = multiline ? '[\\s\\S]*' : '.*';
    const pattern = `^${escaped}${wildcard}$`;
    const flags = this.buildFlags(ignoreCase, multiline);
    return {
      pattern,
      flags,
      display: this.buildDisplay(pattern, flags),
    };
  }

  /**
   * 生成后缀匹配正则表达式 (^.*text$)
   * 匹配以指定文本结尾的整行
   * @param text 原始文本
   * @param ignoreCase 是否忽略大小写
   * @param multiline 是否多行模式
   * @returns 正则表达式结果
   */
  static generateSuffixMatch(text: string, ignoreCase = false, multiline = false): RegexResult {
    const escaped = this.escapeRegex(text);
    // 多行模式使用 [\s\S]* 来匹配包括换行符在内的所有字符
    const wildcard = multiline ? '[\\s\\S]*' : '.*';
    const pattern = `^${wildcard}${escaped}$`;
    const flags = this.buildFlags(ignoreCase, multiline);
    return {
      pattern,
      flags,
      display: this.buildDisplay(pattern, flags),
    };
  }

  /**
   * 生成头尾匹配正则表达式
   * 使用开头和结尾各 N 个字符来匹配（默认 10 个字符）
   * @param text 原始文本
   * @param ignoreCase 是否忽略大小写
   * @param multiline 是否多行模式
   * @param chars 头尾各自使用的字符数（默认 10）
   * @returns 正则表达式结果
   */
  static generateHeadTailMatch(
    text: string,
    ignoreCase = false,
    multiline = false,
    chars = 10
  ): RegexResult {
    // 取开头和结尾各 chars 个字符
    const prefix = text.slice(0, Math.min(chars, text.length));
    const suffix = text.slice(-chars);

    // 转义特殊字符
    const escapedPrefix = this.escapeRegex(prefix);
    const escapedSuffix = this.escapeRegex(suffix);

    // 多行模式使用 [\s\S]* 来匹配包括换行符在内的所有字符
    const wildcard = multiline ? '[\\s\\S]*' : '.*';
    const pattern = `^${escapedPrefix}${wildcard}${escapedSuffix}$`;
    const flags = this.buildFlags(ignoreCase, multiline);

    return {
      pattern,
      flags,
      display: this.buildDisplay(pattern, flags),
    };
  }

  /**
   * 生成包含匹配正则表达式 (text)
   * @param text 原始文本
   * @param ignoreCase 是否忽略大小写
   * @returns 正则表达式结果
   */
  static generateContainsMatch(text: string, ignoreCase = false): RegexResult {
    const escaped = this.escapeRegex(text);
    const pattern = escaped;
    const flags = this.buildFlags(ignoreCase, false);
    return {
      pattern,
      flags,
      display: this.buildDisplay(pattern, flags),
    };
  }

  /**
   * 生成全词语匹配正则表达式
   * 英文使用 \b 单词边界，中文不使用（因为 \b 对中文无效）
   * @param text 原始文本
   * @param ignoreCase 是否忽略大小写
   * @returns 正则表达式结果
   */
  static generateWholeWordMatch(text: string, ignoreCase = false): RegexResult {
    const escaped = this.escapeRegex(text);
    const isAscii = this.isPureAscii(text);

    // 英文使用 \b 边界，中文不使用
    const pattern = isAscii ? `\\b${escaped}\\b` : escaped;
    const flags = this.buildFlags(ignoreCase, false);
    return {
      pattern,
      flags,
      display: this.buildDisplay(pattern, flags),
    };
  }

  /**
   * 主函数：根据匹配模式生成正则表达式
   * @param text 原始文本
   * @param mode 匹配模式
   * @param ignoreCase 是否忽略大小写
   * @param multiline 是否多行模式
   * @returns 正则表达式结果
   */
  static generateRegex(
    text: string,
    mode: MatchMode,
    ignoreCase = false,
    multiline = false
  ): RegexResult {
    switch (mode) {
      case MatchMode.EXACT:
        return this.generateExactMatch(text, ignoreCase, multiline);
      case MatchMode.PREFIX:
        return this.generatePrefixMatch(text, ignoreCase, multiline);
      case MatchMode.SUFFIX:
        return this.generateSuffixMatch(text, ignoreCase, multiline);
      case MatchMode.HEAD_TAIL:
        return this.generateHeadTailMatch(text, ignoreCase, multiline);
      case MatchMode.CONTAINS:
        return this.generateContainsMatch(text, ignoreCase);
      case MatchMode.WHOLE_WORD:
        return this.generateWholeWordMatch(text, ignoreCase);
      case MatchMode.BASED_ON_REQUEST:
        // 基于当前请求创建，不需要从选中内容生成正则
        return { pattern: '', flags: '', display: '' };
      default:
        // 默认使用完整匹配
        return this.generateExactMatch(text, ignoreCase, multiline);
    }
  }

  /**
   * 获取匹配模式的显示名称（中文）
   * @param mode 匹配模式
   * @returns 显示名称
   */
  static getMatchModeLabel(mode: MatchMode): string {
    const labels: Record<MatchMode, string> = {
      [MatchMode.EXACT]: '完整匹配',
      [MatchMode.PREFIX]: '前缀匹配（整行）',
      [MatchMode.SUFFIX]: '后缀匹配（整行）',
      [MatchMode.HEAD_TAIL]: '头尾匹配',
      [MatchMode.CONTAINS]: '包含匹配',
      [MatchMode.WHOLE_WORD]: '全词语匹配',
      [MatchMode.BASED_ON_REQUEST]: '基于当前请求',
    };
    return labels[mode] || mode;
  }

  /**
   * 获取匹配模式的描述
   * @param mode 匹配模式
   * @returns 描述文本
   */
  static getMatchModeDescription(mode: MatchMode): string {
    const descriptions: Record<MatchMode, string> = {
      [MatchMode.EXACT]: '匹配完整文本，如 "/^text$/"',
      [MatchMode.PREFIX]: '匹配以该文本开头的整行，如 "/^prefix.*$/"',
      [MatchMode.SUFFIX]: '匹配以该文本结尾的整行，如 "/^.*suffix$/"',
      [MatchMode.HEAD_TAIL]: '匹配头尾各10字符（前10+后10），如 "/^pre.*suf$/"',
      [MatchMode.CONTAINS]: '匹配包含该文本，如 "/text/"',
      [MatchMode.WHOLE_WORD]: '匹配完整词语（英文使用\\b边界）',
      [MatchMode.BASED_ON_REQUEST]: '基于当前请求的元数据创建规则',
    };
    return descriptions[mode] || '';
  }

  /**
   * 验证正则表达式是否有效
   * @param pattern 正则表达式模式
   * @param flags 正则表达式标志位
   * @returns 是否有效
   */
  static isValidRegex(pattern: string, flags = ''): boolean {
    try {
      new RegExp(pattern, flags);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 将 RegexResult 转换为后端存储格式
   * 后端期望格式：如果 flags 非空，返回 "/pattern/flags"，否则返回 "pattern"
   * @param result 正则表达式结果
   * @returns 后端存储格式的字符串
   */
  static toBackendFormat(result: RegexResult): string {
    if (result.flags) {
      return `/${result.pattern}/${result.flags}`;
    }
    return result.pattern;
  }

  /**
   * 从后端格式解析为 RegexResult
   * @param backendString 后端存储格式的字符串
   * @returns 正则表达式结果
   */
  static fromBackendFormat(backendString: string): RegexResult {
    // 匹配 /pattern/flags 格式
    const match = backendString.match(/^\/(.+?)\/([gimsuvy]*)$/);
    if (match) {
      return {
        pattern: match[1],
        flags: match[2],
        display: backendString,
      };
    }
    // 如果不是 /pattern/flags 格式，直接作为 pattern
    return {
      pattern: backendString,
      flags: '',
      display: backendString,
    };
  }
}
