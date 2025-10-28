import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerConfigSchema, ConfigField } from '../../../types/mcp-config';
import { validateServerConfig, validateField } from '../../../validation/server-config';

interface MultiFieldConfigModalProps {
  schema: ServerConfigSchema;
  onSave: (config: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

export function MultiFieldConfigModal({ schema, onSave, onClose }: MultiFieldConfigModalProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    schema.fields.reduce((acc, field) => ({ ...acc, [field.key]: '' }), {})
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));

    // Real-time Zod validation
    const validation = validateField(schema.id, key, value);
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        if (validation.valid) {
          delete newErrors[key];
        } else {
          newErrors[key] = validation.error || t('multiFieldConfigModal.errors.invalidValue');
        }
        return newErrors;
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validate all fields with Zod
    const validation = validateServerConfig(schema.id, values);

    if (!validation.success && validation.errors) {
      setErrors(validation.errors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(values);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.feedback.unknownError');
      alert(t('multiFieldConfigModal.feedback.saveError', { message }));
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (field: ConfigField) => {
    const commonClasses = "w-full px-4 py-2.5 bg-white border rounded-lg transition-colors focus:outline-none focus:ring-2";
    const errorClasses = errors[field.key]
      ? "border-red-300 focus:border-red-500 focus:ring-red-200"
      : "border-gray-300 focus:border-blue-500 focus:ring-blue-200";

    if (field.type === 'textarea') {
      return (
        <textarea
          value={values[field.key]}
          onChange={(e) => handleChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${commonClasses} ${errorClasses} font-mono text-sm resize-none`}
          disabled={isSaving}
        />
      );
    }

    return (
      <input
        type={field.type === 'password' ? 'password' : 'text'}
        value={values[field.key]}
        onChange={(e) => handleChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        className={`${commonClasses} ${errorClasses} ${field.type === 'password' ? 'font-mono' : ''}`}
        disabled={isSaving}
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {t('multiFieldConfigModal.title', { name: schema.name })}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {schema.configType === 'multiple' && t('multiFieldConfigModal.summary.multiple', { count: schema.fields.length })}
              {schema.configType === 'connection_string' && t('multiFieldConfigModal.summary.connectionString')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSaving}
          >
            <i className="ri-close-line text-2xl"></i>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(event) => { void handleSubmit(event); }} className="p-6 space-y-6">
          {schema.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <label className="block">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  {field.type === 'password' && values[field.key] && (
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById(field.key) as HTMLInputElement;
                        if (input) {
                          input.type = input.type === 'password' ? 'text' : 'password';
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <i className="ri-eye-line mr-1"></i>
                      {t('multiFieldConfigModal.toggleVisibility')}
                    </button>
                  )}
                </div>
                <div id={field.key}>
                  {renderField(field)}
                </div>
              </label>

              {/* Help text */}
              {field.helpText && (
                <p className="text-xs text-gray-500 flex items-start">
                  <i className="ri-information-line mr-1 mt-0.5 flex-shrink-0"></i>
                  <span>{field.helpText}</span>
                </p>
              )}

              {/* Error message */}
              {errors[field.key] && (
                <p className="text-xs text-red-600 flex items-start">
                  <i className="ri-error-warning-line mr-1 mt-0.5 flex-shrink-0"></i>
                  <span>{errors[field.key]}</span>
                </p>
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={isSaving}
            >
              {t('common.actions.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  {t('multiFieldConfigModal.actions.saving')}
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  {t('multiFieldConfigModal.actions.saveAndRestart')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
