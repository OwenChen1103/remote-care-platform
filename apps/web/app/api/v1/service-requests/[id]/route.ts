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
            // photo_url surfaces in mobile [requestId].tsx ProviderCard + admin candidate cards.
            // Without this select, photo_url is always null even when set in DB.
            photo_url: true,
            specialties: true, certifications: true,
            experience_years: true, service_areas: true,
          },
        },
        candidate_provider: {
          select: {
            id: true, name: true, phone: true, level: true,
            // photo_url surfaces in mobile [requestId].tsx ProviderCard + admin candidate cards.
            // Without this select, photo_url is always null even when set in DB.
            photo_url: true,
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
        // Two ownership paths (mirrors /provider/tasks/[id]):
        //   - candidate: candidate_proposed + caregiver_confirmed states — provider
        //     sits in `candidate_provider_id` until they accept; `assigned_provider_id`
        //     is null. Without this branch the provider gets 403 the moment caregiver
        //     confirms, which is the exact window they're being asked to act.
        //   - assigned: every state after the provider accepts (arranged onward, plus
        //     cancelled archive).
        const isCandidate = !!provider &&
          (serviceRequest.status === 'candidate_proposed' || serviceRequest.status === 'caregiver_confirmed') &&
          serviceRequest.candidate_provider_id === provider.id;
        const isAssigned = !!provider && serviceRequest.assigned_provider_id === provider.id;
        if (!isCandidate && !isAssigned) {
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
