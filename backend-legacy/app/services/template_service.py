import io
from openpyxl import Workbook


class TemplateService:
    HEADERS = [
        "上报单位",
        "行业领域",
        "企业类型",
        "企业名称",
        "统一社会信用代码",
        "属地",
        "详细地址",
        "负责人",
        "隐患分类",
        "隐患描述",
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

    SAMPLE = [
        "崇贤街道",
        "商务系统",
        "个体经营",
        "示例企业",
        "91110000123456789X",
        "北京市",
        "北京市朝阳区示例路1号",
        "张三",
        "一般隐患",
        "燃气使用场所安装可燃气体报警装置未启用",
        "一号车间",
        "企业自查",
        "李四、王五",
        "2026-03-16",
        "《商务领域安全生产重大隐患排查事项清单》",
        "《商务系统安全生产风险隐患事项清单》七、餐饮领域",
        "已整改",
        "2026-03-23",
        "崇贤街道/李四",
        "可燃气体报警器已通电启用",
        "",
    ]

    @classmethod
    def generate_excel_template(cls) -> io.BytesIO:
        wb = Workbook()
        ws = wb.active
        ws.title = "导入模板"
        ws.append(cls.HEADERS)
        ws.append(cls.SAMPLE)
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer

    @classmethod
    def generate_csv_template(cls) -> io.BytesIO:
        lines = [
            ",".join(cls.HEADERS) + "\n",
            ",".join(cls.SAMPLE) + "\n",
        ]
        buffer = io.BytesIO()
        buffer.write("".join(lines).encode("utf-8-sig"))
        buffer.seek(0)
        return buffer
