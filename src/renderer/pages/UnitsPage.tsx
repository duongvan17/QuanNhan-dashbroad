import React, { useEffect, useState } from 'react';
import {
  Card, Tree, Button, Modal, Form, Input, Select, Space, Typography,
  Popconfirm, App, Empty, Row, Col, Statistic, Tag,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined,
  TeamOutlined, UserOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { getUnits, createUnit, updateUnit, deleteUnit, getStudents } from '../services/api';
import { useAuth } from '../auth/AuthContext';
import type { Unit, UnitType } from '../../shared/types';

const { Title } = Typography;

const unitTypeLabels: Record<UnitType, string> = {
  tieu_doan: 'Tiểu đoàn',
  dai_doi: 'Đại đội',
  trung_doi: 'Trung đội',
  tieu_doi: 'Tiểu đội',
};

const UnitsPage: React.FC = () => {
  const { message } = App.useApp();
  const { isAdmin } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form] = Form.useForm();
  const [studentsByUnit, setStudentsByUnit] = useState<Record<number, number>>({});
  const [totalStudents, setTotalStudents] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unitData, studentRes] = await Promise.all([
        getUnits(),
        getStudents({ pageSize: 10000 }),
      ]);
      setUnits(unitData);
      const counts: Record<number, number> = {};
      (studentRes.data || []).forEach((s: any) => {
        counts[s.unit_id] = (counts[s.unit_id] || 0) + 1;
      });
      setStudentsByUnit(counts);
      setTotalStudents(studentRes.total ?? (studentRes.data || []).length);
    } catch (err: any) {
      message.error('Lỗi tải đơn vị: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Đếm HV trong cây con (gồm trung đội + các con của đại đội/tiểu đoàn)
  const subtreeStudentCount = (unitId: number): number => {
    let total = studentsByUnit[unitId] || 0;
    units.filter((u) => u.parent_id === unitId).forEach((c) => {
      total += subtreeStudentCount(c.id);
    });
    return total;
  };

  const countByType = (type: UnitType) => units.filter((u) => u.type === type).length;

  const buildTree = (items: Unit[], parentId: number | null = null): any[] => {
    return items
      .filter((u) => u.parent_id === parentId)
      .map((u) => {
        const count = subtreeStudentCount(u.id);
        const tagColor = u.type === 'tieu_doan' ? 'blue' : u.type === 'dai_doi' ? 'cyan' : u.type === 'trung_doi' ? 'geekblue' : 'purple';
        return {
        key: u.id,
        title: (
          <Space>
            <span style={{ fontWeight: u.type === 'tieu_doan' ? 600 : 400 }}>
              {unitTypeLabels[u.type]}: {u.name}
              {u.note && <span style={{ color: '#8c8c8c', fontStyle: 'italic', marginLeft: 8 }}>({u.note})</span>}
            </span>
            <Tag color={tagColor} style={{ marginInlineStart: 4 }}>
              <UserOutlined /> {count} HV
            </Tag>
            {isAdmin && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); openEdit(u); }}
              />
            )}
            {isAdmin && (
              <Popconfirm
                title="Xóa đơn vị này?"
                description="Tất cả đơn vị con và học viên sẽ bị xóa!"
                onConfirm={(e) => { e?.stopPropagation(); handleDelete(u.id); }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            )}
          </Space>
        ),
        children: buildTree(items, u.id),
      };
      });
  };

  const getParentOptions = (type: UnitType) => {
    if (type === 'tieu_doan') return [];
    if (type === 'dai_doi') return units.filter((u) => u.type === 'tieu_doan');
    if (type === 'trung_doi') return units.filter((u) => u.type === 'dai_doi');
    return units.filter((u) => u.type === 'trung_doi');
  };

  const openAdd = () => {
    setEditingUnit(null);
    form.resetFields();
    form.setFieldsValue({ type: 'tieu_doan' });
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditingUnit(unit);
    form.setFieldsValue({ name: unit.name, type: unit.type, parent_id: unit.parent_id, note: unit.note });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingUnit) {
        await updateUnit({ id: editingUnit.id, name: values.name, note: values.note });
      } else {
        await createUnit({
          name: values.name,
          type: values.type,
          parent_id: values.parent_id || null,
          note: values.note || null,
        });
      }
      message.success(editingUnit ? 'Đã cập nhật' : 'Đã thêm');
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUnit(id);
      message.success('Đã xóa');
      loadData();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const typeValue = Form.useWatch('type', form);

  return (
    <div>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>
          <ApartmentOutlined /> Quản lý Đơn vị
        </Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Thêm đơn vị
          </Button>
        )}
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={4}>
          <Card>
            <Statistic
              title="Tiểu đoàn" value={countByType('tieu_doan')}
              prefix={<ApartmentOutlined />} styles={{ content: { color: '#1677ff', fontSize: 26 } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card>
            <Statistic
              title="Đại đội" value={countByType('dai_doi')}
              prefix={<TeamOutlined />} styles={{ content: { color: '#13c2c2', fontSize: 26 } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card>
            <Statistic
              title="Trung đội" value={countByType('trung_doi')}
              prefix={<TrophyOutlined />} styles={{ content: { color: '#722ed1', fontSize: 26 } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card>
            <Statistic
              title="Tiểu đội" value={countByType('tieu_doi')}
              prefix={<TeamOutlined />} styles={{ content: { color: '#eb2f96', fontSize: 26 } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="Tổng học viên" value={totalStudents}
              prefix={<UserOutlined />} styles={{ content: { color: '#52c41a', fontSize: 26 } }}
            />
          </Card>
        </Col>
      </Row>

      <Card loading={loading} title="Cây tổ chức">
        {units.length > 0 ? (
          <Tree
            treeData={buildTree(units)}
            defaultExpandAll
            showLine
            blockNode
          />
        ) : (
          <Empty description="Chưa có đơn vị nào" />
        )}
      </Card>

      <Modal
        title={editingUnit ? 'Sửa đơn vị' : 'Thêm đơn vị'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="Loại đơn vị" rules={[{ required: true }]}>
            <Select disabled={!!editingUnit}>
              <Select.Option value="tieu_doan">Tiểu đoàn</Select.Option>
              <Select.Option value="dai_doi">Đại đội</Select.Option>
              <Select.Option value="trung_doi">Trung đội</Select.Option>
              <Select.Option value="tieu_doi">Tiểu đội</Select.Option>
            </Select>
          </Form.Item>

          {typeValue && typeValue !== 'tieu_doan' && !editingUnit && (
            <Form.Item
              name="parent_id"
              label={
                typeValue === 'dai_doi'
                  ? 'Thuộc Tiểu đoàn'
                  : typeValue === 'trung_doi'
                  ? 'Thuộc Đại đội'
                  : 'Thuộc Trung đội'
              }
              rules={[{ required: true, message: 'Chọn đơn vị cha' }]}
            >
              <Select placeholder="Chọn đơn vị cha">
                {getParentOptions(typeValue).map((u) => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="name" label="Tên đơn vị" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="VD: Tiểu đoàn 1" />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú (Chuyên ngành của Trung đội)">
            <Input.TextArea placeholder="VD: Công binh, Thông tin, Biên phòng..." rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UnitsPage;
