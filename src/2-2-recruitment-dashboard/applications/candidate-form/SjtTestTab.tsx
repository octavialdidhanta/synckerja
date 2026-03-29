import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { Scale, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { getSjtResultFromScores, getDimensionDisplayValue, SJT_DIMENSION_LABELS, type SjtDimensionKey } from '@/shared/lib/sjtResultUtils';

export interface SjtQuestion {
  id: string;
  test_id: string;
  question_order: number;
  scenario_text: string;
  option_1_text: string;
  option_2_text: string;
  option_3_text: string;
  option_4_text: string;
  best_option_index: number;
}

export interface SjtTestTabProps {
  candidateProfileId: string;
  recruitmentToken: string;
  onTestCompleted?: () => void;
  isHRView?: boolean;
  /** When false, candidate must complete DISC first before starting SJT */
  hasDiscCompleted?: boolean;
  /** When false, candidate must complete Cognitive test first before starting SJT */
  hasCognitiveCompleted?: boolean;
}

type Phase = 'idle' | 'running' | 'submitted' | 'time_expired';

const DEFAULT_SJT_TEST_ID = 'a1000000-0000-4000-8000-000000000003';

export function SjtTestTab({
  candidateProfileId,
  recruitmentToken,
  onTestCompleted,
  isHRView,
  hasDiscCompleted = false,
  hasCognitiveCompleted = false,
}: SjtTestTabProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [questions, setQuestions] = useState<SjtQuestion[]>([]);
  const [candidateTestId, setCandidateTestId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [scores, setScores] = useState<{ score_sjt: number; sjt_dimension_scores?: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingStatus, setExistingStatus] = useState<'not_started' | 'in_progress' | 'submitted' | null>(null);
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blurWarnedRef = useRef(false);

  const fetchExistingTestAndQuestions = useCallback(async () => {
    if (!candidateProfileId) return;
    const { data: testMeta } = await supabase
      .from('tests')
      .select('id, duration_minutes')
      .eq('type', 'sjt')
      .eq('is_active', true)
      .maybeSingle();
    const sjtTestId = (testMeta as { id: string; duration_minutes: number } | null)?.id ?? DEFAULT_SJT_TEST_ID;
    if (testMeta) setDurationMinutes((testMeta as { duration_minutes: number }).duration_minutes ?? 15);

    const { data: testRow, error: testErr } = await supabase
      .from('candidate_tests')
      .select('id, status, started_at, submitted_at, score_sjt, sjt_dimension_scores')
      .eq('candidate_profile_id', candidateProfileId)
      .eq('test_id', sjtTestId)
      .maybeSingle();

    if (!testErr && testRow) {
      const row = testRow as {
        id: string;
        status: string;
        started_at?: string;
        submitted_at?: string;
        score_sjt?: number;
        sjt_dimension_scores?: Record<string, number> | null;
      };
      setCandidateTestId(row.id);
      if (row.status === 'submitted') {
        setExistingStatus('submitted');
        setPhase('submitted');
        setScores({ score_sjt: row.score_sjt ?? 0, sjt_dimension_scores: row.sjt_dimension_scores ?? undefined });
        onTestCompleted?.();
        return;
      }
      if (row.status === 'in_progress' && row.started_at) {
        setExistingStatus('in_progress');
        setStartedAt(row.started_at);
        setPhase('running');
      }
    }

    const { data: qList } = await supabase
      .from('sjt_questions')
      .select('*')
      .eq('test_id', sjtTestId)
      .order('question_order', { ascending: true });
    setQuestions((qList as SjtQuestion[]) ?? []);
  }, [candidateProfileId, onTestCompleted]);

  useEffect(() => {
    fetchExistingTestAndQuestions();
  }, [fetchExistingTestAndQuestions]);

  const handleTimeExpired = useCallback(async () => {
    if (!recruitmentToken || !candidateTestId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('sjt_submit_test', {
        p_recruitment_token: recruitmentToken,
        p_candidate_test_id: candidateTestId,
      });
      if (error) throw error;
      const payload = data as { score_sjt: number; sjt_dimension_scores?: Record<string, number> };
      setScores({ score_sjt: payload.score_sjt, sjt_dimension_scores: payload.sjt_dimension_scores });
      setPhase('time_expired');
      onTestCompleted?.();
      toast({
        title: t('candidateProfile.sjt.timeExpiredTitle', 'Waktu habis'),
        description: t('candidateProfile.sjt.timeExpiredDesc', 'Jawaban Anda telah disimpan dan dinilai.'),
        variant: 'default',
      });
    } catch (e: unknown) {
      toast({
        title: t('candidateProfile.sjt.submitFailed', 'Gagal submit'),
        description: (e as Error).message ?? t('candidateProfile.sjt.tryAgain', 'Coba lagi.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [recruitmentToken, candidateTestId, onTestCompleted, toast, t]);

  useEffect(() => {
    if (phase !== 'running' || !startedAt || !durationMinutes) return;
    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, Math.floor((end - now) / 1000));
      setRemainingSeconds(rem);
      if (rem <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleTimeExpired();
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startedAt, durationMinutes, handleTimeExpired]);

  useEffect(() => {
    const onVisibility = () => {
      if (phase !== 'running' || document.visibilityState === 'visible') return;
      if (!blurWarnedRef.current) {
        blurWarnedRef.current = true;
        toast({
          title: t('candidateProfile.sjt.warningTitle', 'Peringatan'),
          description: t('candidateProfile.sjt.warningTab', 'Jangan ganti tab. Tes harus diselesaikan dalam satu sesi.'),
          variant: 'destructive',
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase, toast, t]);

  const startTest = async () => {
    if (!recruitmentToken?.trim()) {
      toast({
        title: t('candidateProfile.sjt.errorTitle', 'Error'),
        description: t('candidateProfile.sjt.invalidToken', 'Token tidak valid.'),
        variant: 'destructive',
      });
      return;
    }
    if (questions.length === 0) {
      const { data: testMeta } = await supabase
        .from('tests')
        .select('id')
        .eq('type', 'sjt')
        .eq('is_active', true)
        .maybeSingle();
      const sjtTestId = (testMeta as { id: string } | null)?.id ?? DEFAULT_SJT_TEST_ID;
      const { data: qList, error: qErr } = await supabase
        .from('sjt_questions')
        .select('*')
        .eq('test_id', sjtTestId)
        .order('question_order', { ascending: true });
      if (qErr || !qList?.length) {
        toast({
          title: t('candidateProfile.sjt.noQuestionsTitle', 'Soal tes belum tersedia'),
          description: t('candidateProfile.sjt.noQuestionsDesc', 'Pastikan migrasi Tes Situasi Kerja sudah dijalankan. Silakan hubungi administrator.'),
          variant: 'destructive',
        });
        return;
      }
      setQuestions((qList as SjtQuestion[]) ?? []);
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('sjt_start_test', {
        p_recruitment_token: recruitmentToken.trim(),
      });
      if (error) throw error;
      const payload = data as { candidate_test_id: string; started_at: string; duration_minutes: number };
      setCandidateTestId(payload.candidate_test_id);
      setStartedAt(payload.started_at);
      setDurationMinutes(payload.duration_minutes);
      setPhase('running');
      setCurrentQuestionIndex(0);
      setSelectedOption(null);
      blurWarnedRef.current = false;
    } catch (e: unknown) {
      toast({
        title: t('candidateProfile.sjt.startFailed', 'Gagal mulai tes'),
        description: (e as Error).message ?? t('candidateProfile.sjt.tryAgain', 'Coba lagi.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const submitAnswerAndNext = async () => {
    const q = questions[currentQuestionIndex];
    if (!q || selectedOption == null) {
      toast({
        title: t('candidateProfile.sjt.selectAnswer', 'Pilih jawaban'),
        description: t('candidateProfile.sjt.selectOneOption', 'Pilih satu opsi untuk melanjutkan.'),
        variant: 'destructive',
      });
      return;
    }
    if (!recruitmentToken || !candidateTestId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('sjt_submit_answer', {
        p_recruitment_token: recruitmentToken.trim(),
        p_candidate_test_id: candidateTestId,
        p_sjt_question_id: q.id,
        p_selected_option_index: selectedOption,
      });
      if (error) throw error;
      setSelectedOption(null);
      if (currentQuestionIndex + 1 >= questions.length) {
        const { data, error: err2 } = await supabase.rpc('sjt_submit_test', {
          p_recruitment_token: recruitmentToken.trim(),
          p_candidate_test_id: candidateTestId,
        });
        if (err2) throw err2;
        const payload = data as { score_sjt: number; sjt_dimension_scores?: Record<string, number> };
        setScores({ score_sjt: payload.score_sjt, sjt_dimension_scores: payload.sjt_dimension_scores });
        setPhase('submitted');
        onTestCompleted?.();
        toast({
          title: t('candidateProfile.sjt.completeTitle', 'Tes selesai'),
          description: t('candidateProfile.sjt.completeDesc', 'Hasil Tes Situasi Kerja Anda telah disimpan.'),
          variant: 'default',
        });
      } else {
        setCurrentQuestionIndex((i) => i + 1);
      }
    } catch (e: unknown) {
      toast({
        title: t('candidateProfile.sjt.saveFailed', 'Gagal menyimpan jawaban'),
        description: (e as Error).message ?? t('candidateProfile.sjt.tryAgain', 'Coba lagi.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const scrollWrapperClass = 'flex flex-col min-h-0 max-h-[calc(100vh-120px)] seamless-scroll overflow-y-auto select-none';
  const preventCopy = (e: React.ClipboardEvent) => e.preventDefault();

  // Submitted / time_expired: show result
  if (existingStatus === 'submitted' || phase === 'submitted' || phase === 'time_expired') {
    const total = scores?.score_sjt ?? 0;
    const totalQuestions = questions.length || 12;
    const dimensionScores = scores?.sjt_dimension_scores;
    const sjtResult = dimensionScores ? getSjtResultFromScores(dimensionScores) : null;
    const dimensionKeys: SjtDimensionKey[] = ['etika', 'komunikasi', 'prioritas', 'konflik', 'prosedur'];
    return (
      <div className={scrollWrapperClass} onCopy={preventCopy}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              {t('candidateProfile.sjt.resultTitle', 'Hasil Tes Situasi Kerja')}
              {phase === 'time_expired' ? ` (${t('candidateProfile.sjt.timeExpiredShort', 'Waktu habis')})` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50/70">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">
                  {t('candidateProfile.sjt.scoreLabel', 'Skor')}: {total}/{totalQuestions}
                </p>
              </div>
            </div>
            {dimensionScores && (
              <div className="flex flex-wrap gap-2 text-sm">
                {dimensionKeys.map((key) => (
                  <span
                    key={key}
                    className="font-mono font-medium px-2 py-1 rounded bg-gray-100 text-gray-800"
                    title={t(`candidateProfile.sjt.dimension.${key}`, SJT_DIMENSION_LABELS[key])}
                  >
                    {t(`candidateProfile.sjt.dimension.${key}`, SJT_DIMENSION_LABELS[key])}: {getDimensionDisplayValue(dimensionScores as Record<string, unknown>, key)}
                  </span>
                ))}
              </div>
            )}
            {sjtResult && (
              <>
                <div className="border border-green-600/30 rounded-md p-4 bg-green-50/50">
                  <h4 className="font-bold text-gray-900 mb-2">{t('candidateProfile.sjt.descriptionTitle', 'Deskripsi Kandidat')}</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{sjtResult.description}</p>
                </div>
                <div className="border border-green-600/30 rounded-md p-4 bg-green-50/50">
                  <h4 className="font-bold text-gray-900 mb-2">{t('candidateProfile.sjt.jobMatchTitle', 'Rekomendasi Peran')}</h4>
                  <p className="text-sm text-gray-700">{sjtResult.jobMatch}</p>
                </div>
                {sjtResult.caveats && (
                  <div className="border border-amber-200 rounded-md p-4 bg-amber-50/70">
                    <h4 className="font-bold text-amber-900 mb-2">{t('candidateProfile.sjt.caveatsTitle', 'Catatan')}</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{sjtResult.caveats}</p>
                  </div>
                )}
              </>
            )}
            {!isHRView && (
              <p className="text-sm text-gray-600">
                {t('candidateProfile.sjt.completedMessage', 'Tes Situasi Kerja telah selesai.')}
              </p>
            )}
            <p className="text-xs text-gray-500">
              {t('candidateProfile.sjt.continueHint', 'Anda dapat melanjutkan ke Submit Profil.')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Idle: gate DISC + Cognitive, or intro + start button
  if (phase === 'idle') {
    if (!hasDiscCompleted || !hasCognitiveCompleted) {
      return (
        <div className={scrollWrapperClass} onCopy={preventCopy}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                {t('candidateProfile.sjt.title', 'Tes Situasi Kerja')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <p className="font-medium">
                  {t('candidateProfile.sjt.completeDiscCognitiveFirst', 'Selesaikan DISC Test dan Test Kognitif terlebih dahulu sebelum mengerjakan Tes Situasi Kerja.')}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                {t('candidateProfile.sjt.completeDiscCognitiveHint', 'Kembali ke tab "DISC Test" dan "Test Kognitif", selesaikan keduanya, lalu Anda dapat mengerjakan Tes Situasi Kerja.')}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className={scrollWrapperClass} onCopy={preventCopy}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              {t('candidateProfile.sjt.title', 'Tes Situasi Kerja')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('candidateProfile.sjt.intro1', 'Tes ini mengukur penilaian Anda dalam situasi kerja: konflik, prioritas, dan etika.')}
            </p>
            <p className="text-sm text-gray-600">
              {t('candidateProfile.sjt.intro2', 'Untuk setiap skenario, pilih satu tindakan yang menurut Anda paling tepat dari empat opsi.')}
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>{t('candidateProfile.sjt.durationLabel', 'Durasi')}: {durationMinutes} {t('candidateProfile.sjt.minutes', 'menit')}.</li>
              <li>{t('candidateProfile.sjt.sessionHint', 'Harap selesaikan dalam satu sesi tanpa mengganti tab atau jendela.')}</li>
              <li>{t('candidateProfile.sjt.timerHint', 'Setelah mulai, timer akan berjalan; waktu habis akan otomatis menyimpan jawaban.')}</li>
            </ul>
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{t('candidateProfile.sjt.tabWarning', 'Jangan menutup atau mengganti tab selama tes berlangsung.')}</span>
            </div>
            <Button onClick={startTest} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? t('candidateProfile.sjt.starting', 'Memulai...') : t('candidateProfile.sjt.startButton', 'Mulai Tes Situasi Kerja')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Running: one scenario per screen
  if (phase === 'running' && questions.length > 0) {
    const q = questions[currentQuestionIndex];
    const options = [
      { index: 1, text: q.option_1_text },
      { index: 2, text: q.option_2_text },
      { index: 3, text: q.option_3_text },
      { index: 4, text: q.option_4_text },
    ];
    const isLast = currentQuestionIndex >= questions.length - 1;
    const questionNo = currentQuestionIndex + 1;

    return (
      <div className={scrollWrapperClass} onCopy={preventCopy}>
        <Card>
          <div className="sticky top-0 z-10 bg-white border-b px-4 py-2 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className={cn('font-mono font-semibold', remainingSeconds <= 120 && 'text-red-600')}>
                {t('candidateProfile.sjt.remainingTime', 'Sisa waktu')}: {formatTime(remainingSeconds)}
              </span>
              {remainingSeconds > 0 && remainingSeconds <= 120 && (
                <span className="text-red-600 text-xs">({t('candidateProfile.sjt.finishSoon', 'Segera selesaikan')})</span>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {t('candidateProfile.sjt.scenarioLabel', 'Skenario')} {questionNo} / {questions.length}
            </span>
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-gray-900">{t('candidateProfile.sjt.situationPrompt', 'Situasi:')}</CardTitle>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{q.scenario_text}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{t('candidateProfile.sjt.chooseBest', 'Pilih tindakan yang paling tepat:')}</p>
            <div className="space-y-2">
              {options.map((opt) => (
                <label
                  key={opt.index}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    selectedOption === opt.index ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <input
                    type="radio"
                    name={`sjt-q-${q.id}`}
                    checked={selectedOption === opt.index}
                    onChange={() => setSelectedOption(opt.index)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{opt.text}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-start pt-4">
              <Button
                onClick={submitAnswerAndNext}
                disabled={loading || selectedOption == null}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading
                  ? t('candidateProfile.sjt.saving', 'Menyimpan...')
                  : isLast
                    ? t('candidateProfile.sjt.finishSubmit', 'Selesai & Kirim')
                    : t('candidateProfile.sjt.next', 'Lanjut')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={scrollWrapperClass} onCopy={preventCopy}>
      <Card>
        <CardContent className="py-8">
          <p className="text-gray-500 text-center">{t('candidateProfile.sjt.loading', 'Memuat tes...')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
