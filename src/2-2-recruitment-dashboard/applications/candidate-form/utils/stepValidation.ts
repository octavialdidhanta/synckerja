
import { supabase } from '@/shared/lib/supabaseClient';

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  message?: string;
}

export const validatePersonalDetails = (candidate: any): ValidationResult => {
  const requiredFields = [
    { key: 'full_name', label: 'Nama Lengkap' },
    { key: 'email', label: 'Email' },
    { key: 'mobile_phone', label: 'Nomor Telepon' },
    { key: 'birth_date', label: 'Tanggal Lahir' },
    { key: 'birth_place', label: 'Tempat Lahir' },
    { key: 'gender', label: 'Jenis Kelamin' },
    { key: 'nik', label: 'NIK' },
    { key: 'religion', label: 'Agama' },
    { key: 'marital_status', label: 'Status Pernikahan' },
    { key: 'nationality', label: 'Kewarganegaraan' },
    { key: 'blood_type', label: 'Golongan Darah' },
    { key: 'photo_url', label: 'Foto Profil' }
  ];

  const missingFields = requiredFields
    .filter(field => {
      const value = candidate?.[field.key];
      const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
      if (isEmpty) {
        console.log(`❌ Missing field: ${field.label} (${field.key}) - value:`, value);
      }
      return isEmpty;
    })
    .map(field => field.label);

  console.log('🔍 Personal validation result:', {
    candidateId: candidate?.id,
    totalFields: requiredFields.length,
    missingFields,
    isValid: missingFields.length === 0
  });

  return {
    isValid: missingFields.length === 0,
    missingFields,
    message: missingFields.length > 0 ? `Mohon lengkapi: ${missingFields.join(', ')}` : 'Data pribadi lengkap'
  };
};

export const validateAddress = (candidate: any): ValidationResult => {
  const requiredFields = [
    { key: 'address', label: 'Alamat' },
    { key: 'citizen_address', label: 'Alamat Sesuai KTP' }
  ];

  const missingFields = requiredFields
    .filter(field => !candidate?.[field.key] || candidate[field.key].trim() === '')
    .map(field => field.label);

  return {
    isValid: missingFields.length === 0,
    missingFields,
    message: missingFields.length > 0 ? `Mohon lengkapi: ${missingFields.join(', ')}` : 'Data alamat lengkap'
  };
};

export const validateDocuments = async (candidateProfileId: string): Promise<ValidationResult> => {
  if (!candidateProfileId) {
    return {
      isValid: false,
      missingFields: ['Candidate Profile ID'],
      message: 'ID profil kandidat tidak ditemukan'
    };
  }

  try {
    const { data: documents, error } = await supabase
      .from('candidate_documents')
      .select('document_type')
      .eq('candidate_profile_id', candidateProfileId);

    if (error) throw error;

    const requiredDocTypes = ['cv', 'ijazah', 'ktp'];
    const availableDocTypes = documents?.map(doc => doc.document_type) || [];
    const missingDocs = requiredDocTypes.filter(type => !availableDocTypes.includes(type));

    const docLabels = {
      'cv': 'CV/Resume',
      'ijazah': 'Ijazah/Certificate',
      'ktp': 'KTP/ID Card'
    };

    const missingLabels = missingDocs.map(doc => docLabels[doc as keyof typeof docLabels]);

    return {
      isValid: missingDocs.length === 0,
      missingFields: missingLabels,
      message: missingDocs.length > 0 ? `Dokumen wajib belum lengkap: ${missingLabels.join(', ')}` : 'Dokumen lengkap'
    };
  } catch (error) {
    console.error('Error validating documents:', error);
    return {
      isValid: false,
      missingFields: ['Document validation failed'],
      message: 'Gagal memvalidasi dokumen'
    };
  }
};

export const validateEducation = async (candidateProfileId: string): Promise<ValidationResult> => {
  if (!candidateProfileId) {
    return {
      isValid: false,
      missingFields: ['Candidate Profile ID'],
      message: 'ID profil kandidat tidak ditemukan'
    };
  }

  try {
    const { data: education, error } = await supabase
      .from('candidate_educations')
      .select('*')
      .eq('candidate_profile_id', candidateProfileId);

    if (error) throw error;

    console.log('🔍 Education validation - Raw data:', education);

    // Validation requires institution_name, degree, and field_of_study (as marked required in UI)
    const validEducations = education?.filter(edu => {
      const isValid = !!(edu.institution_name && edu.institution_name.trim() !== '' &&
                        edu.degree && edu.degree.trim() !== '' &&
                        edu.field_of_study && String(edu.field_of_study).trim() !== '');
      console.log('🔍 Education validation - Item:', {
        id: edu.id,
        institution_name: edu.institution_name,
        degree: edu.degree,
        field_of_study: edu.field_of_study,
        isValid
      });
      return isValid;
    }) || [];

    console.log('🔍 Education validation - Result:', {
      totalEducations: education?.length || 0,
      validEducations: validEducations.length,
      isValid: validEducations.length >= 2
    });

    return {
      isValid: validEducations.length >= 2,
      missingFields: validEducations.length < 2 ? ['Minimum 2 riwayat pendidikan'] : [],
      message: validEducations.length < 2 ? 'Mohon tambahkan minimal 2 riwayat pendidikan yang lengkap' : 'Data pendidikan lengkap'
    };
  } catch (error) {
    console.error('Error validating education:', error);
    return {
      isValid: false,
      missingFields: ['Education validation failed'],
      message: 'Gagal memvalidasi data pendidikan'
    };
  }
};

export const validateWorkExperience = async (candidateProfileId: string): Promise<ValidationResult> => {
  if (!candidateProfileId) {
    return {
      isValid: false,
      missingFields: ['Candidate Profile ID'],
      message: 'ID profil kandidat tidak ditemukan'
    };
  }

  try {
    const { data: workExperience, error } = await supabase
      .from('candidate_work_experiences')
      .select('*')
      .eq('candidate_profile_id', candidateProfileId);

    if (error) throw error;

    const validWorkExperiences = workExperience?.filter(work => 
      work.company_name && work.position && work.start_date
    ) || [];

    return {
      isValid: validWorkExperiences.length >= 1,
      missingFields: validWorkExperiences.length < 1 ? ['Minimum 1 pengalaman kerja'] : [],
      message: validWorkExperiences.length < 1 ? 'Mohon tambahkan minimal 1 pengalaman kerja yang lengkap' : 'Data pengalaman kerja lengkap'
    };
  } catch (error) {
    console.error('Error validating work experience:', error);
    return {
      isValid: false,
      missingFields: ['Work experience validation failed'],
      message: 'Gagal memvalidasi data pengalaman kerja'
    };
  }
};

export const validateFamilyMembers = async (candidateProfileId: string): Promise<ValidationResult> => {
  if (!candidateProfileId) {
    return {
      isValid: false,
      missingFields: ['Candidate Profile ID'],
      message: 'ID profil kandidat tidak ditemukan'
    };
  }

  try {
    const { data: familyMembers, error } = await supabase
      .from('candidate_family_members')
      .select('*')
      .eq('candidate_profile_id', candidateProfileId);

    if (error) throw error;

    const validFamilyMembers = familyMembers?.filter(member => 
      member.name && member.relationship
    ) || [];

    return {
      isValid: validFamilyMembers.length >= 2,
      missingFields: validFamilyMembers.length < 2 ? ['Minimum 2 anggota keluarga'] : [],
      message: validFamilyMembers.length < 2 ? 'Mohon tambahkan minimal 2 anggota keluarga yang lengkap' : 'Data keluarga lengkap'
    };
  } catch (error) {
    console.error('Error validating family members:', error);
    return {
      isValid: false,
      missingFields: ['Family members validation failed'],
      message: 'Gagal memvalidasi data keluarga'
    };
  }
};
