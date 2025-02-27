"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, KeyRound, Hash, Type, Plus, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SchemaNodeData } from "@/app/schemas/editor/[id]/types";

interface SidebarProps {
  selectedNode: string | null;
  onUpdateNode: (data: Partial<SchemaNodeData>) => void;
}

const dataTypes = [
  { id: "uuid", label: "UUID", icon: KeyRound },
  { id: "varchar", label: "VARCHAR", icon: Type },
  { id: "text", label: "TEXT", icon: Type },
  { id: "int4", label: "INTEGER", icon: Hash },
  { id: "money", label: "MONEY", icon: Hash },
  { id: "timestamp", label: "TIMESTAMP", icon: Hash },
  { id: "boolean", label: "BOOLEAN", icon: Hash },
  { id: "jsonb", label: "JSONB", icon: Type },
  { id: "date", label: "DATE", icon: Hash },
  { id: "time", label: "TIME", icon: Hash },
];

const constraints = [
  { id: "primary", label: "Primary Key" },
  { id: "unique", label: "Unique" },
  { id: "notnull", label: "Not Null" },
  { id: "index", label: "Index" },
];

export function Sidebar({ selectedNode, onUpdateNode }: SidebarProps) {
  const [draggedType, setDraggedType] = useState<string | null>(null);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedType(nodeType);
  };

  const onDragEnd = () => {
    setDraggedType(null);
  };

  const addColumn = () => {
    if (!selectedNode) return;
    onUpdateNode({
      schema: [
        ...(selectedNode.data?.schema || []),
        { title: "new_column", type: "varchar", constraints: [] }
      ]
    });
  };

  const updateColumn = (index: number, field: string, value: any) => {
    if (!selectedNode) return;
    const newSchema = [...(selectedNode.data?.schema || [])];
    newSchema[index] = { ...newSchema[index], [field]: value };
    onUpdateNode({ schema: newSchema });
  };

  const removeColumn = (index: number) => {
    if (!selectedNode) return;
    const newSchema = [...(selectedNode.data?.schema || [])];
    newSchema.splice(index, 1);
    onUpdateNode({ schema: newSchema });
  };

  const toggleConstraint = (index: number, constraint: string) => {
    if (!selectedNode) return;
    const newSchema = [...(selectedNode.data?.schema || [])];
    const column = newSchema[index];
    const constraints = column.constraints || [];
    const hasConstraint = constraints.includes(constraint);
    
    newSchema[index] = {
      ...column,
      constraints: hasConstraint 
        ? constraints.filter(c => c !== constraint)
        : [...constraints, constraint]
    };
    
    onUpdateNode({ schema: newSchema });
  };

  return (
    <div className="w-80 border-r bg-background p-4 flex flex-col gap-4 overflow-y-auto">
      <div>
        <h3 className="font-semibold mb-2">Add Table</h3>
        <div
          className="p-3 border rounded-lg cursor-move transition-colors hover:bg-muted"
          draggable
          onDragStart={(e) => onDragStart(e, 'databaseSchema')}
          onDragEnd={onDragEnd}
        >
          <div className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            <span>Database Table</span>
          </div>
        </div>
      </div>

      <Separator />

      {selectedNode ? (
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-4">Table Properties</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Table Name</Label>
                <Input 
                  placeholder="Enter table name" 
                  value={selectedNode.data?.label || ''}
                  onChange={(e) => onUpdateNode({ label: e.target.value })}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Columns</h3>
              <Button onClick={addColumn} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Column
              </Button>
            </div>

            <div className="space-y-4">
              {selectedNode.data?.schema.map((column: any, index: number) => (
                <div key={index} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Column name"
                      value={column.title}
                      onChange={(e) => updateColumn(index, 'title', e.target.value)}
                      className="flex-1"
                    />
                    <Select
                      value={column.type}
                      onValueChange={(value) => updateColumn(index, 'type', value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Data Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {dataTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeColumn(index)}
                      className="text-destructive hover:text-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    {constraints.map((constraint) => (
                      <div key={constraint.id} className="flex items-center gap-2">
                        <Switch
                          checked={(column.constraints || []).includes(constraint.id)}
                          onCheckedChange={() => toggleConstraint(index, constraint.id)}
                          id={`${index}-${constraint.id}`}
                        />
                        <Label htmlFor={`${index}-${constraint.id}`} className="text-sm">
                          {constraint.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground p-4">
          Select a table to edit its properties
        </div>
      )}
    </div>
  );
}