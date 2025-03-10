"use client";

import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, Settings } from "lucide-react";
import { toast } from "sonner";
import { BaseSidebar } from "@/components/ui/sidebar";
import { useSidebarStore } from "../store/sidebar-store";
import { generateSql } from "./SQL-Editor/sqlGenerators";
import { parseSqlToSchema } from "./SQL-Editor/sqlParser";
import EditorComponent from "./SQL-Editor/EditorComponent";
import { validateSqlSyntax, fixCommonSqlIssues } from "./SQL-Editor/sql-validation";
import { useSchemaStore } from "@/hooks/use-schema";
import { SchemaNode } from "../types/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Default settings to use if schema settings are undefined
const defaultSettings = {
  caseSensitiveIdentifiers: false,
  useInlineConstraints: true
};

// Main SQL Editor Component
export function SqlEditor() {
  const { 
    schema, 
    updateNodes, 
    updateEdges, 
    updateCode, 
    updateSettings,
    updateSchema
  } = useSchemaStore();
  
  // Safely access schema properties with defaults for new properties
  const nodes = schema.nodes || [];
  const edges = schema.edges || [];
  const enumTypes = schema.enumTypes || [];
  const settings = schema.settings || defaultSettings;
  
  // New state to store last applied SQL
  const [appliedSql, setAppliedSql] = useState<string>("");
  const [dbType, setDbType] = useState<string>("postgresql");
  const [sqlContent, setSqlContent] = useState<string>("");
  const [editableSql, setEditableSql] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [liveEditMode, setLiveEditMode] = useState<boolean>(false);
  const { widths, updateWidth } = useSidebarStore();
  
  // On mount, initialize settings if they don't exist and generate SQL once
  useEffect(() => {
    if (!schema.settings) {
      updateSettings(defaultSettings);
    }
    
    // Generate SQL once on component mount or when switching to this tab
    if (!appliedSql || appliedSql === "") {
      const initialSql = generateSql(dbType, nodes, edges, enumTypes, settings);
      setAppliedSql(initialSql);
      setSqlContent(initialSql);
      setEditableSql(initialSql);
    }
  }, []);
  
  // Regenerate SQL when db type changes (but not other settings)
  useEffect(() => {
    const newSql = generateSql(dbType, nodes, edges, enumTypes, settings);
    setSqlContent(newSql);
    
    // Only update editable SQL if we're not currently editing
    // This ensures we don't overwrite user-edited SQL
    if (!isEditing) {
      setEditableSql(newSql);
      setAppliedSql(newSql);
      
      // Also update store - this ensures consistency
      updateCode(newSql);
    }
    
    // Log the change for debugging
    console.log("SQL editor db type changed:", dbType);
  }, [dbType]); // Only react to database type changes
  
  // Modify the settings change effect to preserve user edits
  useEffect(() => {
    // Only update the SQL representation when not in editing mode
    // or when explicitly requested (like when Apply is pressed)
    if (!isEditing) {
      // Regenerate SQL completely when settings change
      const newSql = generateSql(dbType, nodes, edges, enumTypes, settings);
      
      // Update all state
      setSqlContent(newSql);
      setAppliedSql(newSql);
      setEditableSql(newSql);
      
      // Also update store to maintain consistency
      updateCode(newSql);
      
      // Log for debugging
      console.log("Settings changed, regenerated SQL:", {
        useInlineConstraints: settings.useInlineConstraints,
        caseSensitive: settings.caseSensitiveIdentifiers
      });
    } else {
      console.log("Settings changed but preserving user edits in editor");
    }
  }, [settings.caseSensitiveIdentifiers, settings.useInlineConstraints]);
  
  // Effect for live updates when SQL changes
  useEffect(() => {
    if (isEditing && liveEditMode && editableSql) {
      handleApplySqlChangesInternal(editableSql, true);
    }
  }, [editableSql, liveEditMode, isEditing]);

  // Add a special effect to force reparse when settings change
  useEffect(() => {
    // Regenerate SQL completely when settings change
    const newSql = generateSql(dbType, nodes, edges, enumTypes, settings);
    
    // Update all state
    setSqlContent(newSql);
    setAppliedSql(newSql);
    
    if (!isEditing) {
      setEditableSql(newSql);
    }
    
    // Also update store to maintain consistency
    updateCode(newSql);
    
    // Log for debugging
    console.log("Settings changed, regenerated SQL:", {
      dbType,
      useInlineConstraints: settings.useInlineConstraints,
      caseSensitive: settings.caseSensitiveIdentifiers,
      edgeCount: edges.length,
      tableCount: nodes.filter(n => n.type === 'databaseSchema' || !n.type).length
    });
  }, [dbType, settings.caseSensitiveIdentifiers, settings.useInlineConstraints]);

  const handleToggleCaseSensitive = () => {
    // First update the setting
    updateSettings({ 
      ...settings,
      caseSensitiveIdentifiers: !settings.caseSensitiveIdentifiers 
    });
    
    // If editing, prompt user to apply changes or warn that settings won't affect current edits
    if (isEditing) {
      toast.info("Apply your changes to see updates with new settings", {
        description: "Current edits are preserved until you apply them",
        action: {
          label: "Apply Now",
          onClick: () => handleApplySqlChanges()
        }
      });
    }
  };

  // Handle toggling inline constraints with immediate SQL reparse
  const handleToggleInlineConstraints = () => {
    console.log("Toggling inline constraints from", settings.useInlineConstraints, "to", !settings.useInlineConstraints);
    
    // First update the setting
    updateSettings({
      ...settings,
      useInlineConstraints: !settings.useInlineConstraints
    });
    
    // If editing, prompt user to apply changes or warn that settings won't affect current edits
    if (isEditing) {
      toast.info("Apply your changes to see updates with new settings", {
        description: "Current edits are preserved until you apply them",
        action: {
          label: "Apply Now",
          onClick: () => handleApplySqlChanges()
        }
      });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([isEditing ? editableSql : sqlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema_${dbType}_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpdateSchema = (newNodes: SchemaNode[], newEdges: any[], newEnumTypes: any[] = []) => {
    updateNodes(newNodes);
    updateEdges(newEdges);
    
    // Update enum types if provided
    if (newEnumTypes.length > 0) {
      updateSchema({ enumTypes: newEnumTypes });
    }
    
    // Also update the SQL code in the store
    updateCode(editableSql);
  };

  const handleApplySqlChangesInternal = (sql: string, isLiveUpdate = false) => {
    try {
      setError(null);
      if (!sql.trim()) {
        setError("SQL cannot be empty");
        return;
      }
      
      let processedSql = sql;
      if (!isLiveUpdate) {
        const originalSql = sql;
        
        // NEW: Fix table names with spaces by adding quotes if they're missing
        processedSql = ensureTableNamesAreQuoted(processedSql);
        
        // Regular SQL fixes
        const fixedSql = fixCommonSqlIssues(processedSql);
        if (fixedSql !== processedSql) {
          processedSql = fixedSql;
          console.log("Fixed SQL syntax:", fixedSql);
        }
        
        // Remove duplicate ALTER TABLE statements
        processedSql = removeDuplicateAlterTableStatements(processedSql);
        console.log("After removing duplicate ALTER TABLE statements:", 
          processedSql.includes("ALTER TABLE") ? 
            `Contains ${(processedSql.match(/ALTER TABLE/g) || []).length} ALTER TABLE statements` : 
            "No ALTER TABLE statements");
      }
      
      try {
        // Log SQL before parsing to help debug issues
        console.log("Parsing SQL:", processedSql);
        const parsedSchema = parseSqlToSchema(processedSql);
        
        if (parsedSchema) {
          console.log("Successfully parsed schema:", parsedSchema.nodes.map(n => n.data?.label));
          
          // Preserve node positions
          const preservedNodes = parsedSchema.nodes.map(newNode => {
            // Look up the existing node, first try by ID
            const existingNode = schema.nodes.find(n => n.id === newNode.id);
            
            // If not found by ID, try by label with case-insensitive matching
            const existingNodeByLabel = !existingNode ? schema.nodes.find(n => 
              n.data?.label && newNode.data?.label && 
              n.data.label.toLowerCase() === newNode.data.label.toLowerCase()
            ) : null;
            
            // Use whichever node we found
            const nodeToPreserve = existingNode || existingNodeByLabel;
            
            if (nodeToPreserve && nodeToPreserve.position) {
              return {
                ...newNode,
                position: nodeToPreserve.position,
                style: nodeToPreserve.style,
                data: {
                  ...newNode.data,
                  color: nodeToPreserve.data?.color || newNode.data?.color
                }
              };
            }
            
            return newNode;
          });
          
          console.log(`Applying schema with ${preservedNodes.length} nodes and ${parsedSchema.edges.length} edges`);
          
          // Update the schema with preserved nodes and unique edges
          handleUpdateSchema(
            preservedNodes,
            parsedSchema.edges,
            parsedSchema.enumTypes || []
          );
          
          // Set the applied SQL for next comparison - use the fixed and deduplicated version
          setAppliedSql(processedSql);
          
          if (!isLiveUpdate) {
            toast.success("SQL changes applied successfully");
            setIsEditing(false);
          }
        }
      } catch (parseError: any) {
        console.error('SQL Parsing Error:', parseError);
        setError(`Failed to parse SQL: ${parseError.message}`);
        return;
      }
    } catch (error: any) {
      console.error('SQL Apply Error:', error);
      setError(`Failed to apply SQL changes: ${error.message}`);
    }
  };

  // NEW: Function to ensure table names with spaces are properly quoted
  const ensureTableNamesAreQuoted = (sql: string): string => {
    // Match CREATE TABLE statements with unquoted table names that contain spaces
    const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+\s+\w+)(?!\s*["'`])\s*\(/gi;
    let result = sql.replace(createTableRegex, 'CREATE TABLE "$1" (');
    
    // Match ALTER TABLE statements with unquoted table names that contain spaces
    const alterTableRegex = /ALTER\s+TABLE\s+(\w+\s+\w+)(?!\s*["'`])\s+/gi;
    result = result.replace(alterTableRegex, 'ALTER TABLE "$1" ');
    
    // Match REFERENCES clauses with unquoted table names that contain spaces
    const referencesRegex = /REFERENCES\s+(\w+\s+\w+)(?!\s*["'`])\s*\(/gi;
    result = result.replace(referencesRegex, 'REFERENCES "$1" (');
    
    return result;
  };

  /**
   * Removes duplicate ALTER TABLE statements from SQL
   */
  const removeDuplicateAlterTableStatements = (sql: string): string => {
    // Track unique constraints by their full definition
    const uniqueConstraints = new Set();
    
    // Split the SQL into sections - this keeps non-ALTER TABLE parts untouched
    const sections = sql.split(/(-- [^\n]+)/);
    
    // Process each section
    const processedSections = sections.map(section => {
      // Only process Foreign Key Constraints sections
      if (!section.includes("Foreign Key Constraints")) {
        return section;
      }
      
      // Split into lines to process individual ALTER TABLE statements
      const lines = section.split('\n');
      const uniqueLines = [];
      
      for (const line of lines) {
        // Extract constraint name from ALTER TABLE statement
        const constraintMatch = /ADD\s+CONSTRAINT\s+(?:"|\`|')?([^"'`\s]+)(?:"|\`|')?/i.exec(line);
        
        if (constraintMatch && line.trim().startsWith('ALTER TABLE')) {
          // Use the full ALTER TABLE statement for uniqueness checking
          // This catches cases where the same constraint name is used for different definitions
          const constraintStatement = line.trim();
          
          if (!uniqueConstraints.has(constraintStatement)) {
            uniqueConstraints.add(constraintStatement);
            uniqueLines.push(line);
          } else {
            console.log(`Removed duplicate ALTER TABLE statement: ${constraintStatement}`);
          }
        } else {
          // Keep non-ALTER TABLE lines (comments, blank lines, etc.)
          uniqueLines.push(line);
        }
      }
      
      return uniqueLines.join('\n');
    });
    
    return processedSections.join('');
  };

  const handleApplySqlChanges = () => {
    handleApplySqlChangesInternal(editableSql);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditableSql(appliedSql);
    setError(null);
  };

  // Header actions for the BaseSidebar
  const headerActions = (
    <>
      <div className="flex items-center gap-2">
        <Select value={dbType} onValueChange={setDbType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Database Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="postgresql">PostgreSQL</SelectItem>
            <SelectItem value="mysql">MySQL</SelectItem>
            <SelectItem value="sqlite">SQLite</SelectItem>
          </SelectContent>
        </Select>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="SQL Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-medium">SQL Settings</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="case-sensitive">Case-sensitive identifiers</Label>
                  <div className="text-xs text-muted-foreground">
                    Use quotes around table and row names
                  </div>
                </div>
                <Switch
                  id="case-sensitive"
                  checked={settings.caseSensitiveIdentifiers}
                  onCheckedChange={handleToggleCaseSensitive}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="inline-constraints">Use inline constraints</Label>
                  <div className="text-xs text-muted-foreground">
                    Add foreign key constraints inside CREATE TABLE instead of ALTER TABLE
                  </div>
                </div>
                <Switch
                  id="inline-constraints"
                  checked={settings.useInlineConstraints}
                  onCheckedChange={handleToggleInlineConstraints}
                />
              </div>
              
              {dbType === "postgresql" && (
                <div className="pt-2">
                  <h5 className="text-sm font-medium mb-2">ENUM Types ({enumTypes.length})</h5>
                  <div className="max-h-24 overflow-y-auto text-xs">
                    {enumTypes.length > 0 ? (
                      <ul className="space-y-1">
                        {enumTypes.map((enumType, index) => (
                          <li key={index} className="flex justify-between items-center">
                            <span className="font-mono">{enumType.name}</span>
                            <span className="text-muted-foreground">
                              ({enumType.values.length} values)
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground italic">No ENUM types defined</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Add ENUM types using CREATE TYPE in the SQL editor
                  </p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex gap-2">
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
        ) : (
          <>
            <div className="flex items-center mr-2">
              <input 
                type="checkbox" 
                id="liveEdit" 
                checked={liveEditMode} 
                onChange={(e) => setLiveEditMode(e.target.checked)} 
                className="mr-1"
              />
              <label htmlFor="liveEdit" className="text-xs">Live</label>
            </div>
            <Button variant="outline" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApplySqlChanges}>
              Apply
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </>
  );

  return (
    <BaseSidebar 
      title="SQL Editor"
      width={widths.sql}
      onWidthChange={(width) => updateWidth('sql', width)}
      maxWidth={800}
      headerActions={headerActions}
      headerClassName="p-4 flex-col gap-3 sm:flex-row"
      collapsible={true}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 m-4 rounded-md border border-destructive overflow-auto">
            <p className="mb-2 font-medium">{error}</p>
            <details className="text-xs opacity-80">
              <summary>Show troubleshooting info</summary>
              <p className="mt-2">If your foreign keys are not showing up, make sure the table names and row names match exactly (including case).</p>
              <p className="mt-1">The ALTER TABLE statement should look like: ALTER TABLE "Table1" ADD CONSTRAINT name FOREIGN KEY ("row") REFERENCES "Table2"("row");</p>
            </details>
          </div>
        )}
        
        <div className="flex-1 h-full bg-muted/30 overflow-hidden">
          <EditorComponent 
            isEditing={isEditing}
            editableSql={editableSql}
            sqlContent={sqlContent}
            setEditableSql={setEditableSql}
          />
        </div>
      </div>
    </BaseSidebar>
  );
}