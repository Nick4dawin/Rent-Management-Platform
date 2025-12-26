import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import { API_ENDPOINTS } from '../lib/constants';
import type { Analytics, ApiResponse } from '../types';

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Analytics>>(
        API_ENDPOINTS.ANALYTICS.OVERVIEW
      );
      return response.data.data;
    },
  });
}
