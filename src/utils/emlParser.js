/**
 * EML Parser v2.4
 * - Rule-based parsing (纯前端，秒级)
 * - AI parsing (LLM，独立调用)
 * - Multi-MPN splitting (/ , or, double-space)
 */

function decodeBase64(str) {
  try { const c = str.replace(/\s/g, ''); const b = atob(c); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++)u[i] = b.charCodeAt(i); return new TextDecoder('utf-8').decode(u) } catch { return str }
}

function decodeQP(str) { return str.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))) }

function decodeRFC2047(str) {
  return str.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (_, c, e, t) => {
    try { if (e.toUpperCase() === 'B') return decodeBase64(t); if (e.toUpperCase() === 'Q') return decodeQP(t.replace(/_/g, ' ')) } catch { return t }
    return t
  })
}

function parseFromHeader(from) {
  const d = decodeRFC2047(from)
  const m = d.match(/<?([^<>\s]+@[^<>\s]+)>?/)
  const email = m ? m[1] : ''
  const n = d.match(/^"?([^"<]+)"?\s*</)
  let name = n ? n[1].trim() : ''
  if (!name && email) name = email.split('@')[0].split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
  return { email: email.trim(), name: name.trim() }
}

function stripForwardedContent(html) {
  const cm = [/<div[^>]*class="?WordSection2"?[^>]*>/i, /<hr[^>]*>/i, /<p[^>]*>\s*_{5,}\s*<\/p>/i, /<p[^>]*>\s*-{5,}\s*<\/p>/i, /<div[^>]*style="[^"]*border[^"]*">/i, /<blockquote/i]
  const tm = [/\n\s*_{5,}\s*\n/, /\n\s*-{5,}\s*\n/, /\n\s*From:\s*[^\n]+[\r\n]+Sent:\s*[^\n]+[\r\n]+To:\s*[^\n]+[\r\n]+Subject:/i, /\n\s*-{2,}\s*Original Message\s*-{2,}/i, /\n\s*-{2,}\s*Forwarded message\s*-{2,}/i, /\n\s*Begin forwarded message/i]
  let c = html
  for (const m of cm) { const i = c.search(m); if (i > 100) { c = c.substring(0, i); break } }
  for (const m of tm) { const x = c.match(m); if (x && x.index > 100) { c = c.substring(0, x.index); break } }
  return c.replace(/<(b|strong|p|div|span)[^>]*>\s*(From|Sent|To|Subject|Cc):\s*<[^>]+>[^<]*<\/\1>/gi, '')
}

/** Split multi-MPN like "ISL91127IIAZ-T / ISL91127IIAZ-T7A / ISL91127IIAZ-TR5723" into separate items */
function splitMultiMpn(item) {
  const m = (item.mpn || '').trim()
  if (!m) return [item]
  if (m.includes('/')) {
    const p = m.split(/\s*\/\s*/).map(x => x.trim()).filter(Boolean)
    if (p.length > 1) return p.map(x => ({ ...item, mpn: x }))
  }
  if (/\s+or\s+/i.test(m)) {
    const p = m.split(/\s+or\s+/i).map(x => x.trim()).filter(Boolean)
    if (p.length > 1) return p.map(x => ({ ...item, mpn: x }))
  }
  const sp = m.split(/\s{2,}/).map(x => x.trim()).filter(Boolean)
  if (sp.length > 1 && sp.every(x => /[A-Z0-9]/.test(x) && x.length >= 4)) return sp.map(x => ({ ...item, mpn: x }))
  return [item]
}

function parseHtmlTable(html) {
  const items = []
  const tr = /<table[^>]*>([\s\S]*?)<\/table>/gi; let tm
  while ((tm = tr.exec(html)) !== null) {
    const rows = []; const rr = /<tr[^>]*>([\s\S]*?)<\/tr>/gi; let rm
    while ((rm = rr.exec(tm[1])) !== null) {
      const cells = []; const cr = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi; let cm; let ci = 0
      while ((cm = cr.exec(rm[1])) !== null) {
        const a = cm[1]; let rc = cm[2]; let cs = 1
        const csm = a.match(/colspan\s*=\s*["']?(\d+)["']?/i); if (csm) cs = parseInt(csm[1])
        rc = rc.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        const ct = rc.replace(/<o:p>[^<]*<\/o:p>/gi, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&/g, '&').replace(/\s+/g, ' ').trim()
        for (let s = 0; s < cs; s++) cells[ci + s] = ct
        ci += cs
      }
      if (cells.length > 0) { const n = {}; cells.forEach((c, i) => { if (c) n[i] = c }); rows.push(n) }
    }
    if (rows.length < 1) continue
    const hr = rows[0]; const cmap = {}
    Object.entries(hr).forEach(([i, v]) => {
      const u = v.toUpperCase().replace(/\s+/g, '')
      if (/MAKER|MFG|BRAND|MANUFACTURE|MAKE/.test(u)) cmap[i] = 'brand'
      else if (/MPN|PART\s*NUMBER|P\/N|MODEL|P\.?N\.?/.test(u) && !/QTY|QUANTITY/.test(u)) cmap[i] = 'mpn'
      else if (/QTY|Q\'?TY|QUANTITY/.test(u)) cmap[i] = 'quantity'
      else if (/^TP$|TARGET.?PRICE/.test(u) && !/DATE/.test(u)) cmap[i] = 'targetPrice'
      else if (/D\/C|DATE.?CODE/.test(u)) cmap[i] = 'batch'
      else if (/L\/T|LEAD.?TIME/.test(u)) cmap[i] = 'leadTime'
      else if (/REMARK|NOTES|DESCRIPTION/.test(u)) cmap[i] = 'notes'
      else if (/PACKAGE|PACKING/.test(u)) cmap[i] = 'package'
      else if (/SPQ/.test(u)) cmap[i] = 'spq'
      else if (/^NO\.?\s*$/i.test(u) || /NUMBER/.test(u)) cmap[i] = '_seq'
    })
    if (Object.keys(cmap).filter(k => cmap[k] !== '_seq').length >= 2) {
      for (let i = 1; i < rows.length; i++) {
        const item = {}
        Object.entries(cmap).forEach(([ci, f]) => {
          if (f === '_seq') return
          const v = rows[i][ci]; if (!v || !v.trim()) return
          const vt = v.trim()
          if (f === 'quantity') { const n = vt.replace(/,/g, '').replace(/[^0-9.kK]/g, ''); item[f] = /k$/i.test(n) ? parseFloat(n) * 1000 : (parseFloat(n) || vt) }
          else if (f === 'targetPrice') { const nm = vt.match(/([\d.]+)/); item[f] = nm ? nm[1] : vt }
          else item[f] = vt
        })
        if (item.mpn || item.brand || item.quantity) { items.push(...splitMultiMpn(item)) }
      }
    }
  }
  return items
}

function parsePlainText(text) {
  const items = []
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let ci = {}; let pf = null
  const kb = ['OKIS', 'MOLE', 'INTERSIL', 'SMTC', 'SEMTECH', 'ON', 'ALTERA', 'BROADCOM', 'DIODES', 'KIOXIA', 'INFINEON', 'MICROCHIP', 'STMICRO', 'WINBOND', 'OMRON', 'NXP', 'TE', 'SHINDENGEN', 'HP', 'WD', 'INTEL', 'XILINX', '3L ELECTRONIC', 'TOSHIBA', 'SAMSUNG', 'SKHYNIX', 'MARVELL', 'CYPRESS', 'RENESAS', 'TI', 'ADI', 'MAXIM', 'LINEAR TECH', 'LINEAR', 'FAIRCHILD', 'VISHAY', 'MURATA', 'TDK', 'PANASONIC', 'ROHM', 'LATTICE', 'MICRON', 'QUALCOMM', 'MEDIATEK', 'REALTEK', 'NVIDIA', 'AMD', 'SEAGATE', 'WESTERN DIGITAL', 'KINGSTON', 'SANDISK', 'ATP', 'SWISSBIT', 'APACER', 'TRANSCEND', 'INNODISK', 'CACTUS']
  for (const line of lines) {
    if (/^(_{5,}|-{5,}|-{2,}\s*(Original|Forwarded)\s*(Message|mail)|From:\s*[^\s@]+@|Sent:\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)|To:\s*[^\s@]+@|Subject:|Begin forwarded|Best regards|Thanks|Regards|Tel|Phone|Mobile|Fax|QQ|Website:|www\.|http)/i.test(line)) {
      if (/^(_{5,}|-{5,}|-{2,}\s*(Original|Forwarded)|Begin forwarded)/i.test(line)) break
      continue
    }
    const u = line.toUpperCase()
    const mb = kb.find(b => u === b.toUpperCase())
    if (mb) {
      if (pf === 'brand' && ci.brand) { if (!ci.mpn) ci.mpn = ci.brand; items.push(...splitMultiMpn(ci)); ci = {} }
      ci.brand = mb; pf = 'brand'; continue
    }
    if (pf === 'brand' && /^[\w\-\/\.\s]{4,35}$/.test(line) && !/^\d+$/.test(line) && !/^(USD|usd|RMB|CNY|EUR)$/i.test(line)) { ci.mpn = line; pf = 'mpn'; continue }
    if (pf === 'mpn' && /^[\d,]+(\s*[kK])?$/.test(line.replace(/\s/g, ''))) { const q = line.replace(/,/g, '').replace(/\s/g, ''); ci.quantity = /k$/i.test(q) ? parseFloat(q) * 1000 : parseInt(q); pf = 'qty'; continue }
    if (pf === 'qty' && (/(USD|usd|\$|[\d.]+\s*USD)/i.test(line) || /^\d{2}\+/i.test(line) || /old\s*dc/i.test(line) || /TUBE|TRAY|REEL|TAPE/i.test(line))) {
      const nm = line.match(/([\d.]+)/); if (nm && /USD|usd|\$/i.test(line)) ci.targetPrice = nm[1]
      const bm = line.match(/(\d{2}\+)/); if (bm) ci.batch = bm[1]
      if (/old\s*dc/i.test(line)) ci.batch = ci.batch ? ci.batch + ' old' : 'old dc ok'
      if (/TUBE/i.test(line)) ci.package = 'TUBE'; if (/TRAY/i.test(line)) ci.package = 'TRAY'
      items.push(...splitMultiMpn(ci)); ci = {}; pf = null; continue
    }
    if (/^[\d,]+$/.test(line.replace(/\s/g, '')) && ci.mpn) { const q = line.replace(/,/g, '').replace(/\s/g, ''); ci.quantity = /k$/i.test(q) ? parseFloat(q) * 1000 : parseInt(q); if (ci.brand && ci.mpn) { items.push(...splitMultiMpn(ci)); ci = {}; pf = null } }
  }
  if (ci.brand && ci.mpn) items.push(...splitMultiMpn(ci))
  return items
}

function extractLatestBody(emlContent) {
  const he = emlContent.indexOf('\r\n\r\n') !== -1 ? emlContent.indexOf('\r\n\r\n') : emlContent.indexOf('\n\n')
  if (he === -1) return { headers: '', htmlContent: '', textContent: '' }
  const headers = emlContent.substring(0, he); let body = emlContent.substring(he + 4)
  const bm = headers.match(/boundary="?([^"\r\n;]+)"?/i); let hc = '', tc = ''
  if (bm) {
    const b = bm[1]; const parts = body.split('--' + b)
    for (const part of parts) {
      const nbm = part.match(/boundary="?([^"\r\n;]+)"?/i)
      if (nbm && nbm[1] !== b) {
        const nb = nbm[1]; const sp = part.split('--' + nb)
        for (const s of sp) {
          const h = s.indexOf('\r\n\r\n') !== -1 ? s.indexOf('\r\n\r\n') + 4 : s.indexOf('\n\n') + 2
          const sb = s.substring(h); const ct = s.match(/Content-Transfer-Encoding:\s*(.+)/i)
          if (s.includes('text/html')) hc = ct?.[1]?.toLowerCase().includes('base64') ? decodeBase64(sb.trim()) : ct?.[1]?.toLowerCase().includes('quoted-printable') ? decodeQP(sb.trim()) : sb.trim()
          if (s.includes('text/plain') && !s.includes('text/html')) tc = ct?.[1]?.toLowerCase().includes('base64') ? decodeBase64(sb.trim()) : sb.trim()
        }
        continue
      }
      const h = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') + 4 : part.indexOf('\n\n') + 2
      const pb = part.substring(h); const ct = part.match(/Content-Transfer-Encoding:\s*(.+)/i)
      if (part.includes('text/html')) hc = ct?.[1]?.toLowerCase().includes('base64') ? decodeBase64(pb.trim()) : ct?.[1]?.toLowerCase().includes('quoted-printable') ? decodeQP(pb.trim()) : pb.trim()
      if (part.includes('text/plain') && !part.includes('text/html')) tc = ct?.[1]?.toLowerCase().includes('base64') ? decodeBase64(pb.trim()) : pb.trim()
    }
  }
  if (!hc && !tc) { const cm = headers.match(/Content-Transfer-Encoding:\s*base64/i); if (cm) { body = decodeBase64(body.trim().replace(/\s/g, '')); if (/<html|<table/i.test(body)) hc = body; else tc = body } }
  if (hc) hc = stripForwardedContent(hc)
  if (tc) tc = tc.replace(/\n\s*_{5,}\s*\n[\s\S]*$/, '').replace(/\n\s*-{2,}\s*(Original|Forwarded)\s*(Message|mail)[\s\S]*$/i, '')
  return { headers, htmlContent: hc, textContent: tc }
}

export function parseEml(emlContent, onProgress) {
  if (onProgress) onProgress('正在解析邮件格式…')
  const { headers, htmlContent, textContent } = extractLatestBody(emlContent)
  const result = { customer: { companyName: '', email: '', contactName: '' }, items: [], rawEmail: emlContent }
  const fm = headers.match(/^From:\s*(.+)$/im)
  if (fm) { const { email, name } = parseFromHeader(fm[1]); result.customer.email = email; result.customer.contactName = name; const d = email.split('@')[1]; if (d) result.customer.companyName = d.split('.')[0].replace(/^(mail\.|smtp\.|email\.)/, '').toUpperCase() }
  if (htmlContent) { const items = parseHtmlTable(htmlContent); if (items.length > 0) { result.items = items; if (onProgress) onProgress(''); return result } }
  const ttp = textContent || ''; if (ttp && !ttp.includes('--=_mailmaster')) { result.items = parsePlainText(ttp) }
  if (result.items.length === 0) { const cb = emlContent.replace(/Content-Type:[^\n]*/gi, '').replace(/Content-Transfer-Encoding:[^\n]*/gi, '').replace(/--=_mailmaster[^\n]*/gi, '').replace(/<[^>]+>/g, ''); result.items = parsePlainText(cb) }
  if (onProgress) onProgress(''); return result
}

import { getLLMConfig } from './llm'

export async function parseEmlWithAI(emlContent, onProgress) {
  const config = getLLMConfig(); if (!config.apiKey || !config.endpoint) throw new Error('请先在设置中配置 LLM API Key')
  if (onProgress) onProgress('正在读取邮件内容…')
  let ct = emlContent.replace(/Content-Type:[^\n]*/gi, '').replace(/Content-Transfer-Encoding:[^\n]*/gi, '').replace(/--=_mailmaster[^\n]*/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&/g, '&').trim()
  ct = ct.replace(/\n\s*_{5,}\s*\n[\s\S]*$/, '').replace(/\n\s*-{2,}\s*(Original|Forwarded)\s*(Message|mail)[\s\S]*$/i, '').substring(0, 5000)
  if (onProgress) onProgress('正在等待 AI 分析（约 3~10 秒）…')
  const prompt = `你是一个芯片/元器件销售数据提取助手。请从以下客户询价邮件中提取结构化的询价数据。

注意：
- 邮件可能包含历史转发/回复内容，只需解析最新一次的询价需求
- 某些型号带有特殊后缀（如 /T、/T7A），必须原样保留
- 如果型号字段包含多个用"/"或"or"分隔的型号，请拆成多个独立的items

请返回以下 JSON 格式（仅返回 JSON）：
{"customer":{"companyName":"客户公司名","email":"发件人邮箱","contactName":"联系人姓名"},"items":[{"brand":"品牌","mpn":"完整型号","quantity":数量,"targetPrice":"目标价","batch":"批次","package":"封装","spq":"SPQ","notes":"备注"}]}

邮件正文：
${ct}`
  const response = await fetch(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: '你是一个数据提取助手。始终只返回纯 JSON。' }, { role: 'user', content: prompt }], temperature: 0.1, max_tokens: 40000 }) })
  if (!response.ok) throw new Error(`LLM API 错误: ${response.status}`); if (onProgress) onProgress('AI 分析完成，正在整理结果…')
  const data = await response.json(); const content = data.choices?.[0]?.message?.content || ''; const jsonMatch = content.match(/\{[\s\S]*\}/); if (!jsonMatch) throw new Error('AI 返回内容无法解析')
  const llmResult = JSON.parse(jsonMatch[0]); if (onProgress) onProgress('')
  const he = emlContent.indexOf('\r\n\r\n') !== -1 ? emlContent.indexOf('\r\n\r\n') : emlContent.indexOf('\n\n'); const fm = emlContent.substring(0, he > 0 ? he : 0).match(/^From:\s*(.+)$/im); let rc = { companyName: '', email: '', contactName: '' }
  if (fm) { const { email, name } = parseFromHeader(fm[1]); rc = { email, contactName: name, companyName: (email.split('@')[1] || '').split('.')[0].toUpperCase() } }
  return { customer: llmResult.customer?.email ? llmResult.customer : rc, items: llmResult.items || [], rawEmail: emlContent, source: 'AI 解析' }
}

export function extractTextFromEml(emlContent) { return emlContent.replace(/Content-Type:[^\n]*/gi, '').replace(/Content-Transfer-Encoding:[^\n]*/gi, '').replace(/--=_mailmaster[^\n]*/gi, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&/g, '&').trim() }