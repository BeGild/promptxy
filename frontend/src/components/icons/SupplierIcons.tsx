/**
 * 供应商官方图标组件
 * 使用 SVG 资源文件
 * 来源：Wikimedia Commons 官方 SVG
 * Anthropic: https://commons.wikimedia.org/wiki/File:Anthropic_logo.svg
 * OpenAI: https://commons.wikimedia.org/wiki/File:OpenAI_Logo.svg
 * Gemini: https://commons.wikimedia.org/wiki/File:Google_Gemini_logo_2025.svg
 */

import React from 'react';
import anthropicIcon from '@/assets/supplier-icons/anthropic.svg';
import openaiIcon from '@/assets/supplier-icons/openai.svg';
import geminiIcon from '@/assets/supplier-icons/gemini.svg';

// Anthropic 官方图标
// 来源: Wikimedia Commons - Anthropic logo (SVG, Public Domain)
export const AnthropicIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <img
    src={anthropicIcon}
    alt="Anthropic"
    className={className}
    style={{ height: size, width: 'auto' }}
  />
);

// OpenAI 官方图标
// 来源: Wikimedia Commons - OpenAI Logo (SVG, Public Domain)
export const OpenAIIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <img
    src={openaiIcon}
    alt="OpenAI"
    className={className}
    style={{ height: size, width: 'auto' }}
  />
);

// Gemini 官方图标 - 2025新版
// 来源: Wikimedia Commons - Google Gemini logo 2025.svg (Public Domain)
export const GeminiIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <img
    src={geminiIcon}
    alt="Gemini"
    className={className}
    style={{ height: size, width: 'auto' }}
  />
);
