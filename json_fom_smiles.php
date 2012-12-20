<?php
$default_dir = "./smiles";
$smiles=array();
if(!($dp = opendir($default_dir))) die("Cannot open $default_dir.");
while($file = readdir($dp))
{
if($file != '.' && $file != '..') 
{
	$fileFull=$file;
	$file=explode(".",$file);
	if(count($file)==2)
	{
		$smiles[]=array("*".$file[0]."*",$fileFull);
		$count++;
    }
    else
    {
		echo "ERROR",$fileFull;
	}
}
}
echo "COUNT:".$count;
echo json_encode($smiles);
closedir($dp); 
?>
