import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import { API_ENDPOINTS } from '../lib/constants';
import type { Mandator, PaginatedResponse, CreateMandatorInput, ApiResponse } from '../types';

export function useMandators(page = 1, limit = 10, search?: string) {
  return useQuery({
    queryKey: ['mandators', page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
      });
      const response = await apiClient.get<PaginatedResponse<Mandator>>(
        `${API_ENDPOINTS.MANDATORS.LIST}?${params}`
      );
      return response.data;
    },
  });
}

export function useMandator(id: string) {
  return useQuery({
    queryKey: ['mandator', id],
    queryFn: async () => {
      const response = await apiClient.get<ApiResponse<Mandator>>(
        API_ENDPOINTS.MANDATORS.GET(id)
      );
      return response.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateMandator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMandatorInput) => {
      const response = await apiClient.post<ApiResponse<Mandator>>(
        API_ENDPOINTS.MANDATORS.CREATE,
        data
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandators'] });
    },
  });
}

export function useActivateMandator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch<ApiResponse<Mandator>>(
        API_ENDPOINTS.MANDATORS.ACTIVATE(id)
      );
      return response.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['mandators'] });
      queryClient.invalidateQueries({ queryKey: ['mandator', id] });
    },
  });
}

export function useDeactivateMandator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch<ApiResponse<Mandator>>(
        API_ENDPOINTS.MANDATORS.DEACTIVATE(id)
      );
      return response.data.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['mandators'] });
      queryClient.invalidateQueries({ queryKey: ['mandator', id] });
    },
  });
}
