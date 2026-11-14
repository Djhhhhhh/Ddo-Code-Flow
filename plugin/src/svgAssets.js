/**
 * svgAssets.js —— docs/index.html 图表原文快照（Webview 内联层，逐字节一致，零改写）。
 * 来源行号与保真规则见 plugin/docs-icon-provenance.md（plan R1 分册 02 §4 映射表）。
 * 2026-11-15 用户修改：插件内标识统一为节点链，host-ic 系列不再挂载（快照集相应收敛）。
 * 修改本文件即破坏 AC-2 比对基线；docs 更新时按映射表重新快照。
 */
'use strict';

const NODES_CHAIN = `<svg width="72" height="72" viewBox="0 0 100 100" role="img" aria-label="Ddo 产品族图标：节点链" style="color: var(--ink)">
                            <g fill="currentColor">
                                <circle cx="32" cy="60" r="6.5"/>
                                <circle cx="50" cy="44" r="6.5"/>
                                <circle cx="66" cy="56" r="3.5" opacity=".8"/>
                                <circle cx="23" cy="46" r="2" opacity=".4"/>
                                <circle cx="72" cy="38" r="1.8" opacity=".35"/>
                            </g>
                            <g fill="none" stroke="currentColor" stroke-width="2" opacity=".5" stroke-linecap="round">
                                <path d="M37.5 56 C42 51 44 49 45.3 47.8"/>
                                <path d="M54.5 48.5 C59 52 61.5 54 63 55"/>
                            </g>
                        </svg>`;

const LIVE_STAR = `<svg class="live-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.7l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.6l-6.2 3.2L7 13.9 2 9l6.9-1z"/></svg>`;

module.exports = { NODES_CHAIN, LIVE_STAR };
