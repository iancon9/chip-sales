# 芯片销售辅助系统 (Chip Sales Support)

基于 Vue 3 + Vite + Element Plus 构建的芯片贸易销售辅助工具，帮助销售人员管理客户询价、生成报价单、统计提成。

## 功能模块

### 仪表盘
- 本月业务概览（询价单数、待处理数、客户数、成交数、利润）
- 当月提成/绩效/奖金自动计算（支持手动调整绩点）
- **全局搜索**：按型号/品牌/客户/邮箱跨所有询价单搜索
- 当月成交订单管理（支持编辑实际数量、成本、成交价并实时重算）
- 最近询价单快速查看

### 询价单管理
- **三种录入方式**：
  - 上传 EML 邮件自动解析（规则引擎 / AI 解析）
  - 粘贴邮件原文解析
  - 手动录入（支持客户下拉搜索）
- **多 EML 上传**：批量上传邮件文件，分 Tab 预览解析结果，每个 EML 生成一个独立询价单
- **多型号拆分**：自动识别 ` / `、` or `、双空格等分隔符，将一个型号拆为多个独立行
- **导入采购报价表**：上传 Excel (xlsx/xls/csv)，自动匹配成本数据
  - 自动识别 Excel 列（型号/MPN、成本价、数量、币种、交期等）
  - MPN 后缀忽略（可在设置页配置 TR、T/R、PBF 等后缀）
  - 同型号多行报价全部保留，自动选择最低成本价
  - 匹配结果可在询价详情页展开查看并二次选择
- 成本录入、批量选择生成报价单

### 报价单管理
- 基于成本 + 定价系数自动计算建议价
- 报价明细编辑（手动调整报价/数量/交期/备注）
- **邮件模板生成**（HTML 格式表格，固定列宽，一键复制到剪贴板）
- **PDF 导出**（jsPDF，后续实现）
- 确认成交 → 自动计入当月提成统计

### 报价参数配置
- 基础利润率设置
- 客户评级系数（A/B/C/D）
- 数量折扣系数
- 批次溢价系数
- 品牌档位系数及映射

### 客户管理
- 按联系人管理客户信息（公司、邮箱、电话、评级）

### 设置
- LLM API 配置（AI 邮件解析用）
- 汇率配置（USD → RMB，4 位小数精度）
- MPN 后缀忽略（影响导入匹配）
- 提成规则配置（多级利润区间 × 提成比例 + 绩点）
- 数据管理（导出/导入 JSON 备份、清空）

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 (Composition API + `<script setup>`) |
| 构建 | Vite 8 |
| UI | Element Plus |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 (Hash 模式) |
| 国际化 | vue-i18n (中文 / English，基础配置) |
| Excel 解析 | SheetJS (xlsx) |
| PDF 导出 | jsPDF |

| 图标 | @element-plus/icons-vue |
| 邮件解析 | 自研规则引擎 + LLM 辅助 |

## 数据存储

- 所有业务数据存储在浏览器 **IndexedDB** 中（不支持时自动降级到 localStorage）
- 可在设置页 → 数据管理进行 JSON 备份/恢复
- 每位销售人员浏览器独立存储，互不影响
- 深色/浅色模式基础设施已建立（CSS 变量），切换 UI 待实现

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 部署

### GitHub Pages

在线地址：**https://iancon9.github.io/chip-sales/**

### 静态部署

```bash
npm run build
# 将 dist/ 目录部署到任意 Web 服务器（Nginx/Apache/IIS）
```

## 项目结构

```
chip-sales/
├── index.html              # 入口 HTML
├── vite.config.js          # Vite 配置（含 GitHub Pages base path）
├── package.json
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── manifest.json          # PWA 配置
└── src/
    ├── App.vue             # 根组件
    ├── main.js             # 应用入口
    ├── style.css           # 全局样式
    ├── router/
    │   └── index.js        # 路由配置
    ├── stores/             # Pinia 状态管理
    │   ├── inquiry.js      # 询价单 Store
    │   ├── quote.js        # 报价单 Store
    │   ├── customer.js     # 客户 Store
    │   ├── closedDeals.js  # 成交单 Store
    │   └── dictionary.js   # 型号稀缺标记 Store
    ├── utils/              # 工具函数
    │   ├── commission.js   # 提成计算
    │   ├── emlParser.js    # EML 邮件解析
    │   ├── llm.js          # LLM API 调用
    │   └── pricingEngine.js # 报价计算公式
    ├── locales/            # 国际化文件
    │   ├── zh-CN.js
    │   └── en.js
    └── views/              # 页面组件
        ├── Dashboard.vue   # 仪表盘
        ├── InquiryList.vue # 询价单列表（含导入）
        ├── InquiryNew.vue  # 新建询价单
        ├── InquiryDetail.vue # 询价单详情/成本录入
        ├── QuoteList.vue   # 报价单列表
        ├── QuoteDetail.vue # 报价单详情/邮件模板
        ├── Dictionary.vue  # 报价参数配置
        ├── Customers.vue   # 客户管理
        └── Settings.vue    # 设置