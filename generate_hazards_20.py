from openpyxl import Workbook
import os

headers = [
    "上报单位",
    "行业领域",
    "企业类型",
    "企业名称",
    "统一社会信用代码",
    "属地",
    "详细地址",
    "负责人",
    "隐患分类",
    "重大隐患描述",
    "隐患位置",
    "检查方式",
    "检查人",
    "检查时间",
    "判定依据",
    "违反判定依据具体条款",
    "是否整改",
    "实际整改完成时间",
    "整改责任部门/责任人",
    "整改措施",
    "举报情况备注",
]

output_dir = "D:/ClaudeCode/safety-hazard-review-system/generated_hazards_v2"
os.makedirs(output_dir, exist_ok=True)

wb = Workbook()
ws = wb.active
ws.title = "导入模板"
ws.append(headers)

for i in range(1, 21):
    row = [
        "上报单位%02d" % i,
        "商务系统",
        "个体经营",
        "测试企业%02d" % i,
        "9111000012345678%02dX" % i,
        "北京市",
        "北京市朝阳区示例路%d号" % i,
        "负责人%02d" % i,
        "管理不到位",
        "测试隐患描述%02d：燃气使用场所安装可燃气体报警装置未启用" % i,
        "车间%02d" % i,
        "企业自查",
        "检查人%02d" % i,
        "2026-03-%02d" % i,
        "《商务领域安全生产重大隐患排查事项清单》",
        "《商务系统安全生产风险隐患事项清单》七、餐饮领域",
        "已整改",
        "2026-04-%02d" % i,
        "责任单位%02d/责任人%02d" % (i, i),
        "已整改完成措施%02d" % i,
        "",
    ]
    ws.append(row)

filepath = os.path.join(output_dir, "hazards_20.xlsx")
wb.save(filepath)
print("Saved %s with %d rows" % (filepath, ws.max_row - 1))
