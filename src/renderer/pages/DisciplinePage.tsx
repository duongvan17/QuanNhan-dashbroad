import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Space, Typography,
  Cascader, App, Tag, Popconfirm, Radio, Tooltip
} from 'antd';
import { PlusOutlined, StarOutlined, CopyOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { getDisciplineScores, saveDisciplineScores, deleteDisciplineScore, getStudents, getUnits } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit } from '../../shared/types';

const { Title } = Typography;

const DisciplinePage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [scores, setScores] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<any>({ nam_hoc: 1, thang: 1 });
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState<'monthly' | 'aggregated'>('monthly');
  const displayScores = searchText
    ? scores.filter((s) => (s.ho_ten || '').toLowerCase().includes(searchText.toLowerCase()))
    : scores;

  const loadUnits = async () => { try { setUnits(await getUnits()); } catch { /* */ } };
  const loadStudents = async (unit_id?: number) => {
    try { const res = await getStudents({ unit_id, pageSize: 500 }); setStudents(res.data); } catch { /* */ }
  };

  const loadScores = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === 'monthly') {
        setScores(await getDisciplineScores(filters));
      } else {
        setScores(await getDisciplineScores({ unit_id: filters.unit_id }));
      }
    }
    catch (err: any) { message.error('Lỗi: ' + err.message); }
    finally { setLoading(false); }
  }, [filters, viewMode]);

  useEffect(() => { loadUnits(); loadStudents(); }, []);
  useEffect(() => { loadScores(); }, [loadScores]);

  const buildCascaderOptions = () => {
    const tieuDoans = units.filter((u) => u.type === 'tieu_doan');
    return tieuDoans.map((td) => ({
      value: td.id, label: td.name,
      children: units.filter((u) => u.type === 'dai_doi' && u.parent_id === td.id).map((dd) => ({
        value: dd.id, label: dd.name,
        children: units.filter((u) => u.type === 'trung_doi' && u.parent_id === dd.id).map((trd) => ({ value: trd.id, label: trd.name })),
      })),
    }));
  };

  const handleFilterUnit = (value: any) => {
    const unit_id = value?.length > 0 ? value[value.length - 1] : undefined;
    setFilters((prev: any) => ({ ...prev, unit_id }));
    loadStudents(unit_id);
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await saveDisciplineScores([{
        ...(editingId ? { id: editingId } : {}),
        student_id: values.student_id,
        nam_hoc: filters.nam_hoc, thang: filters.thang,
        tuan_1: values.tuan_1 ?? null, tuan_2: values.tuan_2 ?? null,
        tuan_3: values.tuan_3 ?? null, tuan_4: values.tuan_4 ?? null,
        tuan_5: values.tuan_5 ?? null,
      }]);
      message.success(editingId ? 'Đã cập nhật' : 'Đã lưu');
      setModalOpen(false); setEditingId(null); form.resetFields(); loadScores();
    } catch (err: any) { if (!err.errorFields) message.error('Lỗi: ' + err.message); }
  };

  const renderDiem = (v: number | null) => {
    if (v == null) return <span style={{ color: '#ccc' }}>-</span>;
    const color = v >= 8 ? '#52c41a' : v >= 5 ? '#1677ff' : '#ff4d4f';
    return <span style={{ fontWeight: 600, fontSize: 15, color }}>{v}</span>;
  };

  const getXepLoaiTag = (v: string | null) => {
    if (!v) return '-';
    const colors: Record<string, string> = { 'Giỏi': 'green', 'Khá': 'blue', 'Trung bình': 'orange', 'Yếu': 'red' };
    return <Tag color={colors[v] || 'default'} style={{ fontSize: 13 }}>{v}</Tag>;
  };

  const buildAggregatedData = () => {
    const studentMap = new Map<number, {
      student_id: number;
      ho_ten: string;
      unit_id: number;
      scores: any[];
    }>();

    scores.forEach((s) => {
      if (!studentMap.has(s.student_id)) {
        const studentInfo = students.find(x => x.id === s.student_id);
        studentMap.set(s.student_id, {
          student_id: s.student_id,
          ho_ten: s.ho_ten,
          unit_id: studentInfo?.unit_id || s.unit_id || 0,
          scores: []
        });
      }
      studentMap.get(s.student_id)!.scores.push(s);
    });

    const getAvgXepLoai = (avg: number | null) => {
      if (avg == null) return '-';
      if (avg >= 8) return 'Giỏi';
      if (avg >= 7.2) return 'Khá';
      if (avg >= 5) return 'Trung bình';
      return 'Yếu';
    };

    const rows = Array.from(studentMap.values()).map((entry) => {
      const yearScores = entry.scores.filter(s => s.nam_hoc === filters.nam_hoc);
      
      const hk1Scores = yearScores.filter(s => [8, 9, 10, 11, 12, 1].includes(s.thang) && s.diem_thang != null);
      const hk1Avg = hk1Scores.length > 0
        ? Math.round((hk1Scores.reduce((sum, s) => sum + Number(s.diem_thang), 0) / hk1Scores.length) * 100) / 100
        : null;

      const hk2Scores = yearScores.filter(s => [2, 3, 4, 5, 6, 7].includes(s.thang) && s.diem_thang != null);
      const hk2Avg = hk2Scores.length > 0
        ? Math.round((hk2Scores.reduce((sum, s) => sum + Number(s.diem_thang), 0) / hk2Scores.length) * 100) / 100
        : null;

      const validYearScores = yearScores.filter(s => s.diem_thang != null);
      const yearAvg = validYearScores.length > 0
        ? Math.round((validYearScores.reduce((sum, s) => sum + Number(s.diem_thang), 0) / validYearScores.length) * 100) / 100
        : null;

      const validAllScores = entry.scores.filter(s => s.diem_thang != null);
      const courseAvg = validAllScores.length > 0
        ? Math.round((validAllScores.reduce((sum, s) => sum + Number(s.diem_thang), 0) / validAllScores.length) * 100) / 100
        : null;

      return {
        key: entry.student_id,
        student_id: entry.student_id,
        ho_ten: entry.ho_ten,
        unit_id: entry.unit_id,
        hk1Avg,
        hk1Xl: getAvgXepLoai(hk1Avg),
        hk2Avg,
        hk2Xl: getAvgXepLoai(hk2Avg),
        yearAvg,
        yearXl: getAvgXepLoai(yearAvg),
        courseAvg,
        courseXl: getAvgXepLoai(courseAvg)
      };
    });

    const sorted = [...rows].sort((a, b) => (b.courseAvg ?? 0) - (a.courseAvg ?? 0));

    const getUnitHierarchy = (uid: number) => {
      const platoon = units.find(u => u.id === uid);
      const company = platoon ? units.find(u => u.id === platoon.parent_id) : null;
      const battalion = company ? units.find(u => u.id === company.parent_id) : null;
      return {
        platoonName: platoon?.name || '',
        companyId: company?.id || null,
        companyName: company?.name || '',
        battalionId: battalion?.id || null,
        battalionName: battalion?.name || ''
      };
    };

    const ranked = sorted.map((item, index, arr) => {
      const h = getUnitHierarchy(item.unit_id);
      
      const platoonList = arr.filter(x => x.unit_id === item.unit_id);
      const platoonRank = platoonList.findIndex(x => x.student_id === item.student_id) + 1;

      const companyList = arr.filter(x => {
        const xh = getUnitHierarchy(x.unit_id);
        return xh.companyId === h.companyId && h.companyId !== null;
      });
      const companyRank = companyList.findIndex(x => x.student_id === item.student_id) + 1;

      const unitStr = [h.companyName, h.platoonName].filter(Boolean).join(' > ');

      return {
        ...item,
        rankOverall: index + 1,
        rankPlatoon: platoonRank,
        rankCompany: companyRank,
        unitStr
      };
    });

    if (searchText) {
      return ranked.filter(r => (r.ho_ten || '').toLowerCase().includes(searchText.toLowerCase()));
    }
    return ranked;
  };

  const handleCopy = () => {
    if (viewMode === 'monthly') {
      const headers = ['STT', 'Họ và tên', 'Tuần 01', 'Tuần 02', 'Tuần 03', 'Tuần 04', 'Tuần 05', 'Điểm tháng', 'Xếp loại'];
      const rows = scores.map((s, i) => [i + 1, s.ho_ten, s.tuan_1 ?? '', s.tuan_2 ?? '', s.tuan_3 ?? '', s.tuan_4 ?? '', s.tuan_5 ?? '', s.diem_thang ?? '', s.xep_loai ?? '']);
      navigator.clipboard.writeText([headers, ...rows].map((r) => r.join('\t')).join('\n'));
    } else {
      const headers = ['Hạng', 'Họ và tên', 'Đơn vị', 'Hạng TĐ', 'Hạng ĐĐ', 'TB Học kỳ I', 'XL Học kỳ I', 'TB Học kỳ II', 'XL Học kỳ II', 'TB Cả năm', 'XL Cả năm', 'TB Toàn khóa', 'XL Toàn khóa'];
      const rows = buildAggregatedData().map((r) => [r.rankOverall, r.ho_ten, r.unitStr, r.rankPlatoon, r.rankCompany, r.hk1Avg ?? '', r.hk1Xl, r.hk2Avg ?? '', r.hk2Xl, r.yearAvg ?? '', r.yearXl, r.courseAvg ?? '', r.courseXl]);
      navigator.clipboard.writeText([headers, ...rows].map((r) => r.join('\t')).join('\n'));
    }
    message.success('Đã copy - paste vào Excel');
  };

  const columns = [
    { title: 'STT', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 200 },
    { title: 'Tuần 01', dataIndex: 'tuan_1', width: 100, align: 'center' as const, render: renderDiem },
    { title: 'Tuần 02', dataIndex: 'tuan_2', width: 100, align: 'center' as const, render: renderDiem },
    { title: 'Tuần 03', dataIndex: 'tuan_3', width: 100, align: 'center' as const, render: renderDiem },
    { title: 'Tuần 04', dataIndex: 'tuan_4', width: 100, align: 'center' as const, render: renderDiem },
    { title: 'Tuần 05', dataIndex: 'tuan_5', width: 100, align: 'center' as const, render: renderDiem },
    {
      title: 'Điểm tháng', dataIndex: 'diem_thang', width: 120, align: 'center' as const,
      render: (v: number | null) => v != null
        ? <span style={{ fontWeight: 700, fontSize: 17, color: v >= 8 ? '#52c41a' : v >= 5 ? '#1677ff' : '#ff4d4f' }}>{v}</span>
        : '-',
    },
    { title: 'Xếp loại', dataIndex: 'xep_loai', width: 120, align: 'center' as const, render: getXepLoaiTag },
    ...(isAdmin ? [{
      title: '', width: 90, align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} type="text" onClick={() => {
            setEditingId(record.id);
            form.setFieldsValue({ student_id: record.student_id, tuan_1: record.tuan_1, tuan_2: record.tuan_2, tuan_3: record.tuan_3, tuan_4: record.tuan_4, tuan_5: record.tuan_5 });
            setModalOpen(true);
          }} />
          <Popconfirm title="Xóa?" onConfirm={async () => {
            try { await deleteDisciplineScore(record.id); message.success('Đã xóa'); loadScores(); }
            catch (err: any) { message.error('Lỗi: ' + err.message); }
          }}>
            <Button size="small" danger icon={<DeleteOutlined />} type="text" />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  const aggregatedColumns = [
    { title: 'Hạng', width: 65, align: 'center' as const, render: (_: any, r: any) => <strong>{r.rankOverall}</strong> },
    { title: 'Họ và tên', dataIndex: 'ho_ten', width: 180, fontWeight: 600 },
    { title: 'Đơn vị', dataIndex: 'unitStr', width: 130 },
    { title: 'Hạng TĐ', dataIndex: 'rankPlatoon', width: 85, align: 'center' as const },
    { title: 'Hạng ĐĐ', dataIndex: 'rankCompany', width: 85, align: 'center' as const },
    {
      title: 'Học kỳ I',
      children: [
        { title: 'Điểm TB', dataIndex: 'hk1Avg', width: 90, align: 'center' as const, render: renderDiem },
        { title: 'Xếp loại', dataIndex: 'hk1Xl', width: 100, align: 'center' as const, render: getXepLoaiTag }
      ]
    },
    {
      title: 'Học kỳ II',
      children: [
        { title: 'Điểm TB', dataIndex: 'hk2Avg', width: 90, align: 'center' as const, render: renderDiem },
        { title: 'Xếp loại', dataIndex: 'hk2Xl', width: 100, align: 'center' as const, render: getXepLoaiTag }
      ]
    },
    {
      title: 'Cả năm',
      children: [
        { title: 'Điểm TB', dataIndex: 'yearAvg', width: 90, align: 'center' as const, render: renderDiem },
        { title: 'Xếp loại', dataIndex: 'yearXl', width: 100, align: 'center' as const, render: getXepLoaiTag }
      ]
    },
    {
      title: 'Toàn khóa',
      children: [
        { title: 'Điểm TB', dataIndex: 'courseAvg', width: 90, align: 'center' as const, render: (v: any) => <strong>{renderDiem(v)}</strong> },
        { title: 'Xếp loại', dataIndex: 'courseXl', width: 100, align: 'center' as const, render: getXepLoaiTag }
      ]
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 20, justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}><StarOutlined /> Điểm rèn luyện</Title>
        <Space wrap>
          <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <Radio.Button value="monthly">Hàng tháng</Radio.Button>
            <Radio.Button value="aggregated">Tổng hợp rèn luyện</Radio.Button>
          </Radio.Group>
          <Cascader options={buildCascaderOptions()} onChange={handleFilterUnit}
            placeholder="Lọc theo đơn vị" changeOnSelect allowClear style={{ width: 250 }} />
          <Select value={filters.nam_hoc} onChange={(v) => setFilters((p: any) => ({ ...p, nam_hoc: v }))} style={{ width: 120 }}>
            {[1,2,3,4].map(n => <Select.Option key={n} value={n}>Năm {['nhất','hai','ba','bốn'][n-1]}</Select.Option>)}
          </Select>
          {viewMode === 'monthly' && (
            <Select value={filters.thang} onChange={(v) => setFilters((p: any) => ({ ...p, thang: v }))} style={{ width: 110 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <Select.Option key={i + 1} value={i + 1}>Tháng {String(i + 1).padStart(2, '0')}</Select.Option>
              ))}
            </Select>
          )}
          <Input.Search
            placeholder="Tìm họ tên..." value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 180 }} allowClear enterButton={<SearchOutlined />}
          />
          <Button icon={<CopyOutlined />} onClick={handleCopy}>Copy bảng</Button>
          {isAdmin && viewMode === 'monthly' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setModalOpen(true); }}>Thêm điểm</Button>
          )}
        </Space>
      </Space>

      <Card styles={{ body: { padding: 0 } }}>
        {viewMode === 'monthly' ? (
          <Table columns={columns} dataSource={displayScores} rowKey="id" loading={loading} size="middle"
            scroll={{ x: 1000 }} pagination={false} bordered />
        ) : (
          <Table columns={aggregatedColumns} dataSource={buildAggregatedData()} rowKey="key" loading={loading} size="middle"
            scroll={{ x: 1100 }} pagination={{ pageSize: 20 }} bordered />
        )}
      </Card>

      {displayScores.length > 0 && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Space size={24}>
            <span>Tổng: <strong>{displayScores.length}</strong> học viên</span>
            <span>
              Giỏi: <Tag color="green">{displayScores.filter(s => s.xep_loai === 'Giỏi').length}</Tag>
              Khá: <Tag color="blue">{displayScores.filter(s => s.xep_loai === 'Khá').length}</Tag>
              TB: <Tag color="orange">{displayScores.filter(s => s.xep_loai === 'Trung bình').length}</Tag>
              Yếu: <Tag color="red">{displayScores.filter(s => s.xep_loai === 'Yếu').length}</Tag>
            </span>
          </Space>
        </Card>
      )}

      <Modal title={editingId ? 'Sửa điểm rèn luyện' : 'Thêm điểm rèn luyện'} open={modalOpen} onOk={handleAdd}
        onCancel={() => { setModalOpen(false); setEditingId(null); }}
        okText="Lưu" cancelText="Hủy" width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="student_id" label="Học viên" rules={[{ required: true }]}>
            <Select placeholder="Chọn" showSearch optionFilterProp="label" disabled={editingId != null}
              options={students.map(s => ({ value: s.id, label: s.ho_ten }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="tuan_1" label="Tuần 01"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="tuan_2" label="Tuần 02"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="tuan_3" label="Tuần 03"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="tuan_4" label="Tuần 04"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="tuan_5" label="Tuần 05"><InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DisciplinePage;
