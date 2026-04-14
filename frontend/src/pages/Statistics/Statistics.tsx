import { useEffect, useState } from 'react'
import { Card, Row, Col, DatePicker, Select } from 'antd'
import { Column, Line } from '@ant-design/charts'
import dayjs from 'dayjs'
import {
  getEnterpriseStats,
  getBatchStats,
  getInspectorStats,
  getTrendStats,
} from '../../api/statistics'

const { RangePicker } = DatePicker

type TrendMetric = 'count' | 'rate'

function Statistics() {
  const [enterpriseData, setEnterpriseData] = useState<any[]>([])
  const [batchData, setBatchData] = useState<any[]>([])
  const [inspectorData, setInspectorData] = useState<any[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('count')

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    fetchTrend()
  }, [dates])

  const fetchAll = async () => {
    try {
      const [eRes, bRes, iRes] = await Promise.all([
        getEnterpriseStats(),
        getBatchStats(),
        getInspectorStats(),
      ])
      setEnterpriseData((eRes as any) || [])
      setBatchData((bRes as any) || [])
      setInspectorData((iRes as any) || [])
    } catch {}
  }

  const fetchTrend = async () => {
    try {
      const params: any = {}
      if (dates) {
        params.start_date = dates[0].format('YYYY-MM-DD')
        params.end_date = dates[1].format('YYYY-MM-DD')
      }
      const res: any = await getTrendStats(params)
      setTrendData(res.points || [])
    } catch {}
  }

  const enterpriseConfig = {
    data: enterpriseData.map((d) => ({
      name: d.enterprise_name,
      value: d.total_hazards,
      type: '隐患总数',
    })),
    xField: 'name',
    yField: 'value',
    seriesField: 'type',
    label: { position: 'top' },
  }

  const trendCountConfig = {
    data: trendData.flatMap((d: any) => [
      { period: d.period, value: d.total_hazards, type: '隐患总数' },
      { period: d.period, value: d.review_count, type: '复核数' },
    ]),
    xField: 'period',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
  }

  const trendRateConfig = {
    data: trendData.flatMap((d: any) => [
      { period: d.period, value: d.coverage_rate, type: '覆盖率' },
      { period: d.period, value: d.pass_rate, type: '通过率' },
    ]),
    xField: 'period',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    yAxis: {
      label: {
        formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
      },
    },
  }

  const inspectorConfig = {
    data: inspectorData.map((d) => ({
      name: d.inspector_name,
      value: d.task_count,
    })),
    xField: 'name',
    yField: 'value',
    label: { position: 'top' },
  }

  const batchConfig = {
    data: batchData.flatMap((d) => [
      { name: d.batch_name, value: d.total_hazards, type: '隐患总数' },
      { name: d.batch_name, value: d.reviewed_count, type: '复核数' },
      { name: d.batch_name, value: d.passed_count, type: '通过数' },
    ]),
    xField: 'name',
    yField: 'value',
    seriesField: 'type',
    isGroup: true,
    label: { position: 'top' },
  }

  const enterpriseStatusConfig = {
    data: enterpriseData.flatMap((d) => [
      { name: d.enterprise_name, value: d.pending_count, type: '待复核' },
      { name: d.enterprise_name, value: d.passed_count, type: '已通过' },
      { name: d.enterprise_name, value: d.failed_count, type: '未通过' },
    ]),
    xField: 'name',
    yField: 'value',
    seriesField: 'type',
    isStack: true,
    color: ({ type }: { type: string }) => {
      if (type === '待复核') return '#fa8c16'
      if (type === '已通过') return '#52c41a'
      return '#f5222d'
    },
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="按企业统计 - 隐患总数">
            <Column {...enterpriseConfig} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="按企业隐患状态分布">
            <Column {...enterpriseStatusConfig} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card
            title="趋势统计"
            extra={
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Select
                  value={trendMetric}
                  onChange={(v) => setTrendMetric(v)}
                  style={{ width: 180 }}
                  options={[
                    { label: '隐患总数 + 复核数', value: 'count' },
                    { label: '通过率 + 覆盖率', value: 'rate' },
                  ]}
                />
                <RangePicker
                  value={dates}
                  onChange={(vals) => setDates(vals as any)}
                />
              </div>
            }
          >
            <Line {...(trendMetric === 'count' ? trendCountConfig : trendRateConfig)} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="监管人员任务数">
            <Column {...inspectorConfig} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="按批次统计">
            <Column {...batchConfig} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Statistics
