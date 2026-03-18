-- Fix profile full_name for FUNDUEANU-CONSTANTIN GHEORGHE to match EPD
UPDATE profiles 
SET full_name = 'FUNDUEANU-CONSTANTIN GHEORGHE', updated_at = NOW()
WHERE user_id = '8d784b97-20e6-4546-9a0b-13aa73a03894' 
  AND full_name = 'CONSTANTIN GHEORGHE FUNDUEANU';