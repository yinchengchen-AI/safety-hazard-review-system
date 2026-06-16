import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { ImportService } from '@/services/import';

describe('ImportService.parseExcel', () => {
  it('parses a simple Excel buffer into rows + errors', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Cases');
    ws.columns = [
      { header: '企业名称', key: 'name', width: 20 },
      { header: '统一社会信用代码', key: 'uscc', width: 20 },
      { header: '隐患类型编码', key: 'htcode', width: 20 },
      { header: '严重程度', key: 'severity', width: 10 },
      { header: '来源', key: 'source', width: 10 },
      { header: '描述', key: 'description', width: 30 },
      { header: '地址', key: 'address', width: 30 },
      { header: '整改期限', key: 'deadline', width: 15 },
    ];
    ws.addRow({
      name: '企业A',
      uscc: '91110000XXXXXX0001',
      htcode: 'FIRE',
      severity: 'MAJOR',
      source: '监管检查',
      description: 'desc',
      address: 'addr',
      deadline: new Date('2026-12-31'),
    });
    const buf = await wb.xlsx.writeBuffer();

    const result = await ImportService.parseExcel(Buffer.from(buf as ArrayBuffer));
    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});
