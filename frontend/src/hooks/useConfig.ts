import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportConfig, importConfig, downloadConfig, uploadConfig } from '@/api/config';

/**
 * 导出配置的 Hook
 */
export function useExportConfig() {
  return useMutation({
    mutationFn: async () => {
      return await exportConfig();
    },
  });
}

/**
 * 导入配置的 Hook
 */
export function useImportConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: any) => {
      return await importConfig(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}

/**
 * 下载配置文件
 */
export function useDownloadConfig() {
  return {
    download: (config: any, filename?: string) => {
      downloadConfig(config, filename);
    },
  };
}

/**
 * 上传配置文件
 */
export function useUploadConfig() {
  return {
    upload: async (): Promise<any> => {
      return await uploadConfig();
    },
  };
}

/**
 * 获取配置的 Hook
 */
export function useConfig() {
  const query = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      return await exportConfig();
    },
    staleTime: 1000 * 60 * 5, // 5分钟
    refetchOnWindowFocus: false,
  });

  return {
    config: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
