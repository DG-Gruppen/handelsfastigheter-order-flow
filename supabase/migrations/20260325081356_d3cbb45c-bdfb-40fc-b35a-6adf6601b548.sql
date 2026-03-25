DO $$
BEGIN
  FOR i IN 1..18 LOOP
    PERFORM pgmq.delete('transactional_emails', i);
  END LOOP;
END $$;