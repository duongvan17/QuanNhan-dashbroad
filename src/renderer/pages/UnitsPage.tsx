import React, { useEffect, useState } from 'react';
import { Card, Tree, Button, Modal, Form, Input, Select, Space, Typography, Popconfirm, App, Empty } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined } from '@ant-design/icons';
import { getUnits, createUnit, updateUnit, deleteUnit } from '../services/api';
import type { Unit, UnitType } from '../../shared/types';

const { Title } = Typography;

const unitTypeLabels: Record<UnitType, string> = {
  tieu_doan: 'Tiểu đoàn',
  dai_doi: 'Đại đội',
  trung_doi: 'Trung đội',
};

const UnitsPage: React.FC = () => {
  const { message } = App.useApp();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [form] = Form.useForm();

  const loadUnits = async () => {
    setLoading(true);
    try {
      const data = await getUnits();
      setUnits(data);
    } catch (err: any) {
      message.error('Lỗi tải đơn vị: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUnits(); }, []);

  const buildTree = (items: Unit[], parentId: number | null = null): any[] => {
    return items
      .filter((u) => u.parent_id === parentId)
      .map((u) => ({
        key: u.id,
        title: (
          <Space>
            <span style={{ fontWeight: u.type === 'tieu_doan' ? 600 : 400 }}>
              {unitTypeLabels[u.type]}: {u.name}
            </span>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => { e.stopPropagation(); openEdit(u); }}
            />
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
          </Space>
        ),
        children: buildTree(items, u.id),
      }));
  };

  const getParentOptions = (type: UnitType) => {
    if (type === 'tieu_doan') return [];
    if (type === 'dai_doi') return units.filter((u) => u.type === 'tieu_doan');
    return units.filter((u) => u.type === 'dai_doi');
  };

  const openAdd = () => {
    setEditingUnit(null);
    form.resetFields();
    form.setFieldsValue({ type: 'tieu_doan' });
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditingUnit(unit);
    form.setFieldsValue({ name: unit.name, type: unit.type, parent_id: unit.parent_id });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingUnit) {
        await updateUnit({ id: editingUnit.id, name: values.name });
      } else {
        await createUnit({
          name: values.name,
          type: values.type,
          parent_id: values.parent_id || null,
        });
      }
      message.success(editingUnit ? 'Đã cập nhật' : 'Đã thêm');
      setModalOpen(false);
      loadUnits();
    } catch (err: any) {
      message.error('Lỗi: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUnit(id);
      message.success('Đã xóa');
      loadUnits();
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
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Thêm đơn vị
        </Button>
      </Space>

      <Card loading={loading}>
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
            </Select>
          </Form.Item>

          {typeValue && typeValue !== 'tieu_doan' && !editingUnit && (
            <Form.Item
              name="parent_id"
              label={typeValue === 'dai_doi' ? 'Thuộc Tiểu đoàn' : 'Thuộc Đại đội'}
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
        </Form>
      </Modal>
    </div>
  );
};

export default UnitsPage;
