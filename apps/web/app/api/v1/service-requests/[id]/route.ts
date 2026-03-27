import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return errorResponse('AUTH_REQUIRED', '請先登入');
    }

    const { id } = await params;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, code: true, name: true } },
        recipient: { select: { id: true, name: true } },
        assigned_provider: {
          select: {
            id: true, name: true, phone: true, level: true,
            specialties: true, certifications: true,
            experience_years: true, service_areas: true,
          },
        },
        candidate_provider: {
          select: {
            id: true, name: true, phone: true, level: true,
            specialties: true, certifications: true,
            experience_years: true, service_areas: true,
          },
        },
      },
    });

    if (!serviceRequest) {
      return errorResponse('RESOURCE_NOT_FOUND', '找不到此服務需求');
    }

    // Ownership check by role
    switch (auth.role) {
      case 'caregiver':
        if (serviceRequest.caregiver_id !== auth.userId) {
          return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此服務需求');
        }
        break;

      case 'patient': {
        const recipient = await prisma.recipient.findFirst({
          where: { patient_user_id: auth.userId, deleted_at: null },
          select: { id: true },
        });
        if (!recipient || serviceRequest.recipient_id !== recipient.id) {
          return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此服務需求');
        }
        break;
      }

      case 'provider': {
        const provider = await prisma.provider.findFirst({
          where: { user_id: auth.userId, deleted_at: null },
          select: { id: true },
        });
        if (!provider || serviceRequest.assigned_provider_id !== provider.id) {
          return errorResponse('RESOURCE_OWNERSHIP_DENIED', '無權存取此服務需求');
        }
        break;
      }

      case 'admin':
        // Admin can see all
        break;

      default:
        return errorResponse('AUTH_FORBIDDEN', '無權存取');
    }

    return successResponse(serviceRequest);
  } catch {
    return errorResponse('SERVER_ERROR', '伺服器錯誤，請稍後再試');
  }
}
