/* ============================================================
 *  饮库 DrinkDB —— 导出模块
 *  ------------------------------------------------------------
 *  任何访客都可以导出全库。提供两种格式：
 *    · Excel (.xls) —— HTML 表格 + Excel MIME，Excel / WPS 直接打开，
 *      中文字段与列宽都正常，不需要任何第三方库。
 *    · CSV (.csv)   —— UTF-8 BOM，通用性最好，方便导入其它工具。
 * ============================================================ */
(function (global) {

  var COLUMNS = [
    ['类别',        'c'],
    ['产品名',      'n'],
    ['品牌',        'b'],
    ['英文/别名',   'en'],
    ['含糖 g/100ml', 'sg'],
    ['糖分星级',    's'],
    ['甜度星级',    'sw'],
    ['代糖类型',    'sub'],
    ['代糖后味★',   'at'],
    ['热量 kcal/100ml', 'kc'],
    ['是否碳酸',    function (x) { return x.cb > 0 ? '是' : '否'; }],
    ['气泡强度★',   'cb'],
    ['放一天后气泡★', 'fd'],
    ['开盖一天掉气★', 'flatLoss'],
    ['冰镇',        function (x) { return { better: '冰了更好喝', same: '常温也行', worse: '冰了反而差' }[x.ice]; }],
    ['酒精 %vol',   'abv'],
    ['咖啡因 mg/100ml', 'cf'],
    ['含茶',        function (x) { return x.tea ? '是' : '否'; }],
    ['含奶',        function (x) { return x.dairy ? '是' : '否'; }],
    ['含果葡糖浆',  function (x) { return x.hfcs ? '是' : '否'; }],
    ['常规容量 ml', 'ml'],
    ['包装',        'pk'],
    ['参考价 ¥',    'p'],
    ['大众化★',     'pop'],
    ['酸感★',       'ph'],
    ['特征小结',    'brief'],
    ['备注',        'note'],
    ['数据来源',    function (x) { return x.fromUser ? '网友提交（已审核）' : '内置种子库'; }],
  ];

  function cell(x, col) {
    var v = typeof col[1] === 'function' ? col[1](x) : x[col[1]];
    return v === null || v === undefined ? '' : v;
  }

  function stamp() {
    var d = new Date();
    function z(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes());
  }

  function download(content, filename, mime) {
    var blob = new Blob(['\ufeff' + content], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  global.Exporter = {
    columns: COLUMNS,

    /** Excel：HTML 表格伪装成 .xls，Excel/WPS 打开即带列宽与表头 */
    toExcel: function (list, opts) {
      opts = opts || {};
      var title = opts.title || '饮库 DrinkDB 全库导出';
      var head = COLUMNS.map(function (c) { return '<th>' + esc(c[0]) + '</th>'; }).join('');
      var body = list.map(function (x) {
        return '<tr>' + COLUMNS.map(function (c) { return '<td>' + esc(cell(x, c)) + '</td>'; }).join('') + '</tr>';
      }).join('');

      var html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">'
        + '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>'
        + '<x:Name>饮库</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>'
        + '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->'
        + '<style>'
        + 'table{border-collapse:collapse;font-family:"Microsoft YaHei",sans-serif;font-size:11pt}'
        + 'th{background:#2f6b8f;color:#fff;border:1px solid #999;padding:5px 8px;text-align:left;white-space:nowrap}'
        + 'td{border:1px solid #ccc;padding:4px 8px;vertical-align:top}'
        + '.t{font-size:14pt;font-weight:bold;padding:8px 0}'
        + '</style></head><body>'
        + '<div class="t">' + esc(title) + '　（' + list.length + ' 款 · 导出于 ' + stamp() + '）</div>'
        + '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>'
        + '<p style="font-family:sans-serif;font-size:9pt;color:#666">'
        + '数据来源：饮库 DrinkDB　|　糖分、热量等数值为常见规格的参考值，不同批次与口味可能不同，请以实际包装标签为准。'
        + '</p></body></html>';

      download(html, (opts.filename || '饮库DrinkDB') + '-' + stamp() + '.xls', 'application/vnd.ms-excel');
    },

    /** CSV：通用格式 */
    toCSV: function (list, opts) {
      opts = opts || {};
      function q(v) {
        v = v === null || v === undefined ? '' : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }
      var lines = [COLUMNS.map(function (c) { return q(c[0]); }).join(',')];
      list.forEach(function (x) {
        lines.push(COLUMNS.map(function (c) { return q(cell(x, c)); }).join(','));
      });
      download(lines.join('\r\n'), (opts.filename || '饮库DrinkDB') + '-' + stamp() + '.csv', 'text/csv');
    },

    /** JSON：给后台备份 / 迁移用 */
    toJSON: function (obj, filename) {
      download(JSON.stringify(obj, null, 2), (filename || 'drinkdb-backup') + '-' + stamp() + '.json', 'application/json');
    },
  };

})(window);
