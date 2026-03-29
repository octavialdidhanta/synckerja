import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { Brain, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export interface CognitiveQuestion {
  id: string;
  test_id: string;
  question_order: number;
  question_text: string;
  option_1_text: string;
  option_2_text: string;
  option_3_text: string;
  option_4_text: string;
  correct_option_index: number;
  category: string | null;
}

export interface CognitiveTestTabProps {
  candidateProfileId: string;
  recruitmentToken: string;
  onTestCompleted?: () => void;
  isHRView?: boolean;
  /** When false, candidate must complete DISC first before starting Cognitive test */
  hasDiscCompleted?: boolean;
}

type Phase = 'idle' | 'running' | 'submitted' | 'time_expired';

const DEFAULT_COGNITIVE_TEST_ID = 'a1000000-0000-4000-8000-000000000002';

export function CognitiveTestTab({
  candidateProfileId,
  recruitmentToken,
  onTestCompleted,
  isHRView,
  hasDiscCompleted = false,
}: CognitiveTestTabProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [questions, setQuestions] = useState<CognitiveQuestion[]>([]);
  const [candidateTestId, setCandidateTestId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [scores, setScores] = useState<{
    score_total: number;
    score_verbal?: number;
    score_numerical?: number;
    score_logical?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingStatus, setExistingStatus] = useState<'not_started' | 'in_progress' | 'submitted' | null>(null);
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blurWarnedRef = useRef(false);
  const endsAtRef = useRef<number>(0);

  const fetchExistingTestAndQuestions = useCallback(async () => {
    if (!candidateProfileId) return;
    const { data: testMeta } = await supabase
      .from('tests')
      .select('id, duration_minutes')
      .eq('type', 'cognitive')
      .eq('is_active', true)
      .maybeSingle();
    const cognitiveTestId = (testMeta as { id: string; duration_minutes: number } | null)?.id ?? DEFAULT_COGNITIVE_TEST_ID;
    if (testMeta) setDurationMinutes((testMeta as { duration_minutes: number }).duration_minutes ?? 15);

    const { data: testRow, error: testErr } = await supabase
      .from('candidate_tests')
      .select('id, status, started_at, submitted_at, score_total, score_verbal, score_numerical, score_logical')
      .eq('candidate_profile_id', candidateProfileId)
      .eq('test_id', cognitiveTestId)
      .maybeSingle();

    if (!testErr && testRow) {
      const row = testRow as {
        id: string;
        status: string;
        started_at?: string;
        submitted_at?: string;
        score_total?: number;
        score_verbal?: number;
        score_numerical?: number;
        score_logical?: number;
      };
      setCandidateTestId(row.id);
      if (row.status === 'submitted') {
        setExistingStatus('submitted');
        setPhase('submitted');
        setScores({
          score_total: row.score_total ?? 0,
          score_verbal: row.score_verbal ?? 0,
          score_numerical: row.score_numerical ?? 0,
          score_logical: row.score_logical ?? 0,
        });
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
      .from('cognitive_questions')
      .select('*')
      .eq('test_id', cognitiveTestId)
      .order('question_order', { ascending: true });
    setQuestions((qList as CognitiveQuestion[]) ?? []);
  }, [candidateProfileId, onTestCompleted]);

  useEffect(() => {
    fetchExistingTestAndQuestions();
  }, [fetchExistingTestAndQuestions]);

  const handleTimeExpired = useCallback(async () => {
    if (!recruitmentToken || !candidateTestId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('cognitive_submit_test', {
        p_recruitment_token: recruitmentToken,
        p_candidate_test_id: candidateTestId,
      });
      if (error) throw error;
      setScores(data as { score_total: number; score_verbal?: number; score_numerical?: number; score_logical?: number });
      setPhase('time_expired');
      onTestCompleted?.();
      toast({
        title: t('candidateProfile.cognitive.timeExpiredTitle', 'Waktu habis'),
        description: t('candidateProfile.cognitive.timeExpiredDesc', 'Jawaban Anda telah disimpan dan dinilai.'),
        variant: 'default',
      });
    } catch (e: unknown) {
      toast({
        title: t('candidateProfile.cognitive.submitFailed', 'Gagal submit'),
        description: (e as Error).message ?? t('candidateProfile.cognitive.tryAgain', 'Coba lagi.'),
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
    endsAtRef.current = end;
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
          title: t('candidateProfile.cognitive.warningTitle', 'Peringatan'),
          description: t('candidateProfile.cognitive.warningTab', 'Jangan ganti tab. Tes harus diselesaikan dalam satu sesi.'),
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
        title: t('candidateProfile.cognitive.errorTitle', 'Error'),
        description: t('candidateProfile.cognitive.invalidToken', 'Token tidak valid.'),
        variant: 'destructive',
      });
      return;
    }
    if (questions.length === 0) {
      const { data: testMeta } = await supabase
        .from('tests')
        .select('id')
        .eq('type', 'cognitive')
        .eq('is_active', true)
        .maybeSingle();
      const cognitiveTestId = (testMeta as { id: string } | null)?.id ?? DEFAULT_COGNITIVE_TEST_ID;
      const { data: qList, error: qErr } = await supabase
        .from('cognitive_questions')
        .select('*')
        .eq('test_id', cognitiveTestId)
        .order('question_order', { ascending: true });
      if (qErr || !qList?.length) {
        toast({
          title: t('candidateProfile.cognitive.noQuestionsTitle', 'Soal tes belum tersedia'),
          description: t('candidateProfile.cognitive.noQuestionsDesc', 'Pastikan migrasi Test Kognitif sudah dijalankan. Silakan hubungi administrator.'),
          variant: 'destructive',
        });
        return;
      }
      setQuestions((qList as CognitiveQuestion[]) ?? []);
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('cognitive_start_test', {
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
        title: t('candidateProfile.cognitive.startFailed', 'Gagal mulai tes'),
        description: (e as Error).message ?? t('candidateProfile.cognitive.tryAgain', 'Coba lagi.'),
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
        title: t('candidateProfile.cognitive.selectAnswer', 'Pilih jawaban'),
        description: t('candidateProfile.cognitive.selectOneOption', 'Pilih satu opsi untuk melanjutkan.'),
        variant: 'destructive',
      });
      return;
    }
    if (!recruitmentToken || !candidateTestId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('cognitive_submit_answer', {
        p_recruitment_token: recruitmentToken.trim(),
        p_candidate_test_id: candidateTestId,
        p_cognitive_question_id: q.id,
        p_selected_option_index: selectedOption,
      });
      if (error) throw error;
      setSelectedOption(null);
      if (currentQuestionIndex + 1 >= questions.length) {
        const { data, error: err2 } = await supabase.rpc('cognitive_submit_test', {
          p_recruitment_token: recruitmentToken.trim(),
          p_candidate_test_id: candidateTestId,
        });
        if (err2) throw err2;
        setScores(data as { score_total: number; score_verbal?: number; score_numerical?: number; score_logical?: number });
        setPhase('submitted');
        onTestCompleted?.();
        toast({
          title: t('candidateProfile.cognitive.completeTitle', 'Tes selesai'),
          description: t('candidateProfile.cognitive.completeDesc', 'Hasil Test Kognitif Anda telah disimpan.'),
          variant: 'default',
        });
      } else {
        setCurrentQuestionIndex((i) => i + 1);
      }
    } catch (e: unknown) {
      toast({
        title: t('candidateProfile.cognitive.saveFailed', 'Gagal menyimpan jawaban'),
        description: (e as Error).message ?? t('candidateProfile.cognitive.tryAgain', 'Coba lagi.'),
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
    const total = scores?.score_total ?? 0;
    const totalQuestions = questions.length || 30;
    return (
      <div className={scrollWrapperClass} onCopy={preventCopy}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            {t('candidateProfile.cognitive.resultTitle', 'Hasil Test Kognitif')}
            {phase === 'time_expired' ? ` (${t('candidateProfile.cognitive.timeExpiredShort', 'Waktu habis')})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50/70">
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">
                {t('candidateProfile.cognitive.scoreLabel', 'Skor')}: {total}/{totalQuestions}
              </p>
              {isHRView && (scores?.score_verbal != null || scores?.score_numerical != null || scores?.score_logical != null) && (
                <p className="text-sm text-gray-600 mt-1">
                  Verbal: {scores?.score_verbal ?? 0} | Numerical: {scores?.score_numerical ?? 0} | Logical: {scores?.score_logical ?? 0}
                </p>
              )}
            </div>
          </div>
          {!isHRView && (
            <p className="text-sm text-gray-600">
              {t('candidateProfile.cognitive.completedMessage', 'Test Kognitif telah selesai.')}
            </p>
          )}
          <p className="text-xs text-gray-500">
            {t('candidateProfile.cognitive.continueHint', 'Anda dapat melanjutkan ke Submit Profil.')}
          </p>
        </CardContent>
      </Card>
      </div>
    );
  }

  // Idle: intro and start button (or gate: complete DISC first)
  if (phase === 'idle') {
    if (!hasDiscCompleted) {
      return (
        <div className={scrollWrapperClass} onCopy={preventCopy}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                {t('candidateProfile.cognitive.title', 'Test Kognitif')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <p className="font-medium">
                  {t('candidateProfile.cognitive.completeDiscFirst', 'Selesaikan DISC Test terlebih dahulu sebelum mengerjakan Test Kognitif.')}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                {t('candidateProfile.cognitive.completeDiscHint', 'Kembali ke tab "DISC Test", selesaikan tes tersebut, lalu Anda dapat mengerjakan Test Kognitif.')}
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
            <Brain className="h-5 w-5" />
            {t('candidateProfile.cognitive.title', 'Test Kognitif')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('candidateProfile.cognitive.intro1', 'Tes ini mengukur kemampuan kognitif Anda: penalaran verbal, numerik, dan logika.')}
          </p>
          <p className="text-sm text-gray-600">
            {t('candidateProfile.cognitive.intro2', 'Untuk setiap soal, pilih satu jawaban yang benar dari empat opsi. Tidak ada jawaban yang bisa dikosongkan.')}
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>{t('candidateProfile.cognitive.durationLabel', 'Durasi')}: {durationMinutes} {t('candidateProfile.cognitive.minutes', 'menit')}.</li>
            <li>{t('candidateProfile.cognitive.sessionHint', 'Harap selesaikan dalam satu sesi tanpa mengganti tab atau jendela.')}</li>
            <li>{t('candidateProfile.cognitive.timerHint', 'Setelah mulai, timer akan berjalan; waktu habis akan otomatis menyimpan jawaban.')}</li>
          </ul>
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{t('candidateProfile.cognitive.tabWarning', 'Jangan menutup atau mengganti tab selama tes berlangsung.')}</span>
          </div>
          <Button onClick={startTest} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? t('candidateProfile.cognitive.starting', 'Memulai...') : t('candidateProfile.cognitive.startButton', 'Mulai Test Kognitif')}
          </Button>
        </CardContent>
      </Card>
      </div>
    );
  }

  // Running: one question per screen
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
              {t('candidateProfile.cognitive.remainingTime', 'Sisa waktu')}: {formatTime(remainingSeconds)}
            </span>
            {remainingSeconds > 0 && remainingSeconds <= 120 && (
              <span className="text-red-600 text-xs">({t('candidateProfile.cognitive.finishSoon', 'Segera selesaikan')})</span>
            )}
          </div>
          <span className="text-sm text-gray-500">
            {t('candidateProfile.cognitive.questionLabel', 'Soal')} {questionNo} / {questions.length}
          </span>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{q.question_text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  name={`cognitive-q-${q.id}`}
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
                ? t('candidateProfile.cognitive.saving', 'Menyimpan...')
                : isLast
                  ? t('candidateProfile.cognitive.finishSubmit', 'Selesai & Kirim')
                  : t('candidateProfile.cognitive.next', 'Lanjut')}
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
          <p className="text-gray-500 text-center">{t('candidateProfile.cognitive.loading', 'Memuat tes...')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
